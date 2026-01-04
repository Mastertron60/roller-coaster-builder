import { create } from "zustand";
import * as THREE from "three";
import { LOOP_RADIUS, HELIX_SEPARATION, LOOP_POINTS_COUNT, EXIT_SEPARATION, FORWARD_SEPARATION, SCALE } from "@/lib/config/scale";

export type CoasterMode = "build" | "ride" | "preview";

export interface LoopMetadata {
  entryPos: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  radius: number;
  theta: number; // 0 to 2π position in loop
}

export interface TrackPoint {
  id: string;
  position: THREE.Vector3;
  tilt: number;
  loopMeta?: LoopMetadata; // Present if this point is part of a loop
}

interface RollerCoasterState {
  mode: CoasterMode;
  trackPoints: TrackPoint[];
  selectedPointId: string | null;
  rideProgress: number;
  isRiding: boolean;
  rideSpeed: number;
  isDraggingPoint: boolean;
  isAddingPoints: boolean;
  isLooped: boolean;
  hasChainLift: boolean;
  showWoodSupports: boolean;
  isNightMode: boolean;
  cameraTarget: THREE.Vector3 | null;
  
  setMode: (mode: CoasterMode) => void;
  setCameraTarget: (target: THREE.Vector3 | null) => void;
  addTrackPoint: (position: THREE.Vector3) => void;
  updateTrackPoint: (id: string, position: THREE.Vector3) => void;
  updateTrackPointTilt: (id: string, tilt: number) => void;
  removeTrackPoint: (id: string) => void;
  createLoopAtPoint: (id: string) => void;
  selectPoint: (id: string | null) => void;
  clearTrack: () => void;
  setRideProgress: (progress: number) => void;
  setIsRiding: (riding: boolean) => void;
  setRideSpeed: (speed: number) => void;
  setIsDraggingPoint: (dragging: boolean) => void;
  setIsAddingPoints: (adding: boolean) => void;
  setIsLooped: (looped: boolean) => void;
  setHasChainLift: (hasChain: boolean) => void;
  setShowWoodSupports: (show: boolean) => void;
  setIsNightMode: (night: boolean) => void;
  startRide: () => void;
  stopRide: () => void;
}

let pointCounter = 0;

export const useRollerCoaster = create<RollerCoasterState>((set, get) => ({
  mode: "build",
  trackPoints: [],
  selectedPointId: null,
  rideProgress: 0,
  isRiding: false,
  rideSpeed: 1.0,
  isDraggingPoint: false,
  isAddingPoints: true,
  isLooped: false,
  hasChainLift: true,
  showWoodSupports: false,
  isNightMode: false,
  cameraTarget: null,
  
  setMode: (mode) => set({ mode }),
  
  setCameraTarget: (target) => set({ cameraTarget: target }),
  
  setIsDraggingPoint: (dragging) => set({ isDraggingPoint: dragging }),
  
  setIsAddingPoints: (adding) => set({ isAddingPoints: adding }),
  
  setIsLooped: (looped) => set({ isLooped: looped }),
  
  setHasChainLift: (hasChain) => set({ hasChainLift: hasChain }),
  
  setShowWoodSupports: (show) => set({ showWoodSupports: show }),
  
  setIsNightMode: (night) => set({ isNightMode: night }),
  
  addTrackPoint: (position) => {
    const id = `point-${++pointCounter}`;
    set((state) => ({
      trackPoints: [...state.trackPoints, { id, position: position.clone(), tilt: 0 }],
    }));
  },
  
  updateTrackPoint: (id, position) => {
    set((state) => ({
      trackPoints: state.trackPoints.map((point) =>
        point.id === id ? { ...point, position: position.clone() } : point
      ),
    }));
  },
  
  updateTrackPointTilt: (id, tilt) => {
    set((state) => ({
      trackPoints: state.trackPoints.map((point) =>
        point.id === id ? { ...point, tilt } : point
      ),
    }));
  },
  
  removeTrackPoint: (id) => {
    set((state) => ({
      trackPoints: state.trackPoints.filter((point) => point.id !== id),
      selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
    }));
  },
  
  createLoopAtPoint: (id) => {
    set((state) => {
      const pointIndex = state.trackPoints.findIndex((p) => p.id === id);
      if (pointIndex === -1) return state;
      
      const entryPoint = state.trackPoints[pointIndex];
      const entryPos = entryPoint.position.clone();
      
      // Calculate forward direction from track
      let forward = new THREE.Vector3(1, 0, 0);
      if (pointIndex > 0) {
        const prevPoint = state.trackPoints[pointIndex - 1];
        forward = entryPos.clone().sub(prevPoint.position);
        forward.y = 0;
        if (forward.length() < 0.1) {
          forward = new THREE.Vector3(1, 0, 0);
        }
        forward.normalize();
      }
      
      const loopRadius = LOOP_RADIUS;
      const totalLoopPoints = LOOP_POINTS_COUNT;
      const loopPoints: TrackPoint[] = [];
      const helixSeparation = HELIX_SEPARATION;
      
      // Compute right vector for corkscrew offset
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      
      // === APPROACH POINTS: Smooth entry into the loop ===
      // Create an "entry anchor" ahead of entryPos that aligns with the loop's forward direction
      const approachPoints: TrackPoint[] = [];
      const prevPoint = pointIndex > 0 ? state.trackPoints[pointIndex - 1] : null;
      const prevPrevPoint = pointIndex > 1 ? state.trackPoints[pointIndex - 2] : null;
      
      if (prevPoint) {
        const prevPos = prevPoint.position.clone();
        const approachLength = loopRadius * 0.8; // Length of approach curve
        
        // Direction from prevPrev to prev (legacy track direction)
        let legacyDir: THREE.Vector3;
        if (prevPrevPoint) {
          legacyDir = prevPos.clone().sub(prevPrevPoint.position).normalize();
        } else {
          legacyDir = entryPos.clone().sub(prevPos).normalize();
        }
        legacyDir.y = 0;
        legacyDir.normalize();
        
        // Entry tangent must match loop's forward direction
        const entryTangent = forward.clone();
        
        // Create an entry anchor point that's slightly before the entry
        // positioned to smoothly guide into the loop
        const entryAnchor = entryPos.clone().sub(forward.clone().multiplyScalar(loopRadius * 0.3));
        
        // Hermite from prevPos to entryAnchor
        const hermite = (t: number, p0: THREE.Vector3, t0: THREE.Vector3, p1: THREE.Vector3, t1: THREE.Vector3, scale: number): THREE.Vector3 => {
          const t2 = t * t;
          const t3 = t2 * t;
          
          const h00 = 2*t3 - 3*t2 + 1;
          const h10 = t3 - 2*t2 + t;
          const h01 = -2*t3 + 3*t2;
          const h11 = t3 - t2;
          
          return new THREE.Vector3()
            .addScaledVector(p0, h00)
            .addScaledVector(t0, h10 * scale)
            .addScaledVector(p1, h01)
            .addScaledVector(t1, h11 * scale);
        };
        
        const dist1 = prevPos.distanceTo(entryAnchor);
        const dist2 = entryAnchor.distanceTo(entryPos);
        
        // First segment: prevPos to entryAnchor (align with legacy direction -> forward)
        approachPoints.push({
          id: `point-${++pointCounter}`,
          position: hermite(0.5, prevPos, legacyDir, entryAnchor, forward, dist1 * 0.5),
          tilt: 0
        });
        
        // Second segment: entryAnchor to entryPos (both tangents are forward)
        approachPoints.push({
          id: `point-${++pointCounter}`,
          position: hermite(0.5, entryAnchor, forward, entryPos, forward, dist2 * 0.5),
          tilt: 0
        });
      }
      
      // Build helical loop with mild corkscrew
      // Lateral offset increases linearly throughout to separate entry from exit
      for (let i = 1; i <= totalLoopPoints; i++) {
        const t = i / totalLoopPoints; // 0 to 1
        const theta = t * Math.PI * 2; // 0 to 2π
        
        const forwardOffset = Math.sin(theta) * loopRadius;
        const verticalOffset = (1 - Math.cos(theta)) * loopRadius;
        
        // Gradual corkscrew: linear lateral offset
        const lateralOffset = t * helixSeparation;
        
        loopPoints.push({
          id: `point-${++pointCounter}`,
          position: new THREE.Vector3(
            entryPos.x + forward.x * forwardOffset + right.x * lateralOffset,
            entryPos.y + verticalOffset,
            entryPos.z + forward.z * forwardOffset + right.z * lateralOffset
          ),
          tilt: 0,
          loopMeta: {
            entryPos: entryPos.clone(),
            forward: forward.clone(),
            up: up.clone(),
            right: right.clone(),
            radius: loopRadius,
            theta: theta
          }
        });
      }
      
      // Get the next point (unchanged) so we can rejoin it
      const nextPoint = state.trackPoints[pointIndex + 1];
      
      // Loop exit position (last point of loop) - same as entry position
      const loopExit = loopPoints[loopPoints.length - 1].position.clone();
      
      // Use same right vector from loop generation for transition separation
      const exitSeparation = EXIT_SEPARATION;
      const forwardSeparation = FORWARD_SEPARATION;
      
      // Offset the loop exit both forward and laterally to clear the entry track
      const offsetLoopExit = loopExit.clone()
        .add(forward.clone().multiplyScalar(forwardSeparation))
        .add(right.clone().multiplyScalar(exitSeparation));
      
      // === EXIT TRANSITION: Smooth exit from the loop ===
      // Use offsetLoopExit as an anchor to create a two-stage smooth exit
      const transitionPoints: TrackPoint[] = [];
      
      // We need to skip the immediate next points and target further down the track
      const nextNextPoint = state.trackPoints[pointIndex + 2];
      const nextNextNextPoint = state.trackPoints[pointIndex + 3];
      const targetPoint = nextNextNextPoint || nextNextPoint || nextPoint;
      
      // Hermite helper
      const hermite = (t: number, p0: THREE.Vector3, t0: THREE.Vector3, p1: THREE.Vector3, t1: THREE.Vector3, scale: number): THREE.Vector3 => {
        const t2 = t * t;
        const t3 = t2 * t;
        
        const h00 = 2*t3 - 3*t2 + 1;
        const h10 = t3 - 2*t2 + t;
        const h01 = -2*t3 + 3*t2;
        const h11 = t3 - t2;
        
        return new THREE.Vector3()
          .addScaledVector(p0, h00)
          .addScaledVector(t0, h10 * scale)
          .addScaledVector(p1, h01)
          .addScaledVector(t1, h11 * scale);
      };
      
      // Loop exit tangent: at θ=2π, tangent = forward
      const exitTangent = forward.clone();
      
      // First stage: loopExit to offsetLoopExit (both using forward tangent)
      const dist1 = loopExit.distanceTo(offsetLoopExit);
      transitionPoints.push({
        id: `point-${++pointCounter}`,
        position: hermite(0.5, loopExit, exitTangent, offsetLoopExit, forward, dist1 * 0.6),
        tilt: 0
      });
      
      // Add the offset anchor point itself
      transitionPoints.push({
        id: `point-${++pointCounter}`,
        position: offsetLoopExit.clone(),
        tilt: 0
      });
      
      if (targetPoint) {
        const targetPos = targetPoint.position.clone();
        
        // Legacy track direction (from target toward the point after it)
        const pointAfterTarget = nextNextNextPoint 
          ? state.trackPoints[pointIndex + 4]
          : (nextNextPoint ? state.trackPoints[pointIndex + 3] : state.trackPoints[pointIndex + 2]);
        
        let legacyTangent: THREE.Vector3;
        
        if (pointAfterTarget) {
          // Direction the legacy track is heading
          legacyTangent = pointAfterTarget.position.clone().sub(targetPos).normalize();
        } else {
          // No point after, just use direction from anchor to target
          legacyTangent = targetPos.clone().sub(offsetLoopExit).normalize();
        }
        legacyTangent.y = 0;
        legacyTangent.normalize();
        
        // Second stage: offsetLoopExit to targetPos
        const dist2 = offsetLoopExit.distanceTo(targetPos);
        
        // Sample 2 points along this Hermite curve
        transitionPoints.push({
          id: `point-${++pointCounter}`,
          position: hermite(0.33, offsetLoopExit, forward, targetPos, legacyTangent, dist2 * 0.5),
          tilt: 0
        });
        
        transitionPoints.push({
          id: `point-${++pointCounter}`,
          position: hermite(0.66, offsetLoopExit, forward, targetPos, legacyTangent, dist2 * 0.5),
          tilt: 0
        });
      }
      
      // Combine: original up to BEFORE entry + approach + entry + loop + transitions + skip legacy points + rest
      // Skip legacy points that are now replaced by our smooth transitions
      const skipCount = nextNextNextPoint ? 3 : (nextNextPoint ? 2 : 1);
      const newTrackPoints = [
        ...state.trackPoints.slice(0, pointIndex), // All points before entry
        ...approachPoints,                          // Smooth approach to entry
        entryPoint,                                 // The entry point itself
        ...loopPoints,                              // The loop
        ...transitionPoints,                        // Smooth exit transition
        ...state.trackPoints.slice(pointIndex + 1 + skipCount) // Skip entry and replaced legacy points
      ];
      
      return { trackPoints: newTrackPoints };
    });
  },
  
  selectPoint: (id) => set({ selectedPointId: id }),
  
  clearTrack: () => {
    set({ trackPoints: [], selectedPointId: null, rideProgress: 0, isRiding: false });
  },
  
  setRideProgress: (progress) => set({ rideProgress: progress }),
  
  setIsRiding: (riding) => set({ isRiding: riding }),
  
  setRideSpeed: (speed) => set({ rideSpeed: speed }),
  
  startRide: () => {
    const { trackPoints } = get();
    if (trackPoints.length >= 2) {
      set({ mode: "ride", isRiding: true, rideProgress: 0 });
    }
  },
  
  stopRide: () => {
    set({ mode: "build", isRiding: false, rideProgress: 0 });
  },
}));
