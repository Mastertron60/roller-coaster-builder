import { create } from "zustand";
import * as THREE from "three";

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
      
      const loopRadius = 4;
      const totalLoopPoints = 20;
      const loopPoints: TrackPoint[] = [];
      const helixSeparation = 1.75; // Mild corkscrew separation
      
      // Compute right vector for corkscrew offset
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      
      // Get the next legacy point to blend toward
      const nextLegacyPoint = state.trackPoints[pointIndex + 1];
      
      // Build helical loop with mild corkscrew
      // Lateral offset increases linearly, but eases back in final quarter to blend toward next point
      for (let i = 1; i <= totalLoopPoints; i++) {
        const t = i / totalLoopPoints; // 0 to 1
        const theta = t * Math.PI * 2; // 0 to 2π
        
        const forwardOffset = Math.sin(theta) * loopRadius;
        const verticalOffset = (1 - Math.cos(theta)) * loopRadius;
        
        // Lateral offset: increases to max at 3/4 point, then eases back toward next point
        let lateralOffset: number;
        const blendStart = 0.75; // Start blending at 75% through the loop
        
        if (t < blendStart) {
          // Normal helical offset up to blend point
          lateralOffset = (t / blendStart) * helixSeparation;
        } else {
          // Ease the offset back toward where we need to go
          const blendT = (t - blendStart) / (1 - blendStart); // 0 to 1 in blend zone
          const easeT = blendT * blendT * (3 - 2 * blendT); // Smooth step
          lateralOffset = helixSeparation * (1 - easeT * 0.7); // Keep some offset but reduce
        }
        
        const loopPos = new THREE.Vector3(
          entryPos.x + forward.x * forwardOffset + right.x * lateralOffset,
          entryPos.y + verticalOffset,
          entryPos.z + forward.z * forwardOffset + right.z * lateralOffset
        );
        
        // For the final few points, blend toward the next legacy point direction
        if (nextLegacyPoint && t > blendStart) {
          const blendT = (t - blendStart) / (1 - blendStart);
          const easeT = blendT * blendT * (3 - 2 * blendT);
          
          // Compute where the pure loop would exit
          const pureExitForward = entryPos.clone().add(forward.clone().multiplyScalar(0));
          pureExitForward.add(right.clone().multiplyScalar(helixSeparation));
          
          // Direction toward next point from current loop position
          const toNext = nextLegacyPoint.position.clone().sub(loopPos);
          const distToNext = toNext.length();
          
          // Subtly pull the position toward a line leading to next point
          // Only affect the horizontal, keep the vertical from the loop
          if (distToNext > 0.1) {
            toNext.normalize();
            const pullStrength = easeT * 0.3; // Gentle pull
            loopPos.x += toNext.x * pullStrength * 2;
            loopPos.z += toNext.z * pullStrength * 2;
          }
        }
        
        loopPoints.push({
          id: `point-${++pointCounter}`,
          position: loopPos,
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
      
      // Combine: original up to entry + loop + original remainder (unchanged)
      const newTrackPoints = [
        ...state.trackPoints.slice(0, pointIndex + 1),
        ...loopPoints,
        ...state.trackPoints.slice(pointIndex + 1)
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
