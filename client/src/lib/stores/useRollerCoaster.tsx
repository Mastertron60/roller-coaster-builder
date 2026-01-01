import { create } from "zustand";
import * as THREE from "three";

export type CoasterMode = "build" | "ride" | "preview";

export interface TrackPoint {
  id: string;
  position: THREE.Vector3;
  tilt: number;
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
      if (pointIndex === -1 || pointIndex >= state.trackPoints.length - 1) return state;
      
      const entryPoint = state.trackPoints[pointIndex];
      const exitPoint = state.trackPoints[pointIndex + 1];
      const entryPos = entryPoint.position.clone();
      const exitPos = exitPoint.position.clone();
      
      // Calculate forward direction from entry to exit
      const segment = exitPos.clone().sub(entryPos);
      let forward = segment.clone();
      forward.y = 0;
      if (forward.length() < 0.1) {
        forward = new THREE.Vector3(1, 0, 0);
      }
      forward.normalize();
      
      // Loop parameters
      const loopRadius = 8;
      const arcPoints = 12;
      
      // Loop center is midway between entry and exit, at loopRadius height
      const midX = (entryPos.x + exitPos.x) / 2;
      const midZ = (entryPos.z + exitPos.z) / 2;
      const baseY = Math.min(entryPos.y, exitPos.y);
      const loopCenterY = baseY + loopRadius;
      
      // Generate loop arc points
      // Start at entry (back of loop), go up, over top (upside down), down to exit (front)
      const loopPoints: TrackPoint[] = [];
      
      for (let i = 1; i < arcPoints; i++) {
        const t = i / arcPoints;
        // Angle goes from -PI/2 (back/entry) through PI/2 (top) to 3PI/2 (front/exit)
        const angle = -Math.PI / 2 + t * Math.PI * 2;
        
        // sin: -1 at entry, 0 at sides, +1 at exit
        const forwardT = (Math.sin(angle) + 1) / 2; // 0 to 1
        // cos: 0 at entry/exit, 1 at top
        const heightOffset = Math.cos(angle) * loopRadius;
        
        // Interpolate X and Z between entry and exit based on forward progress
        const x = entryPos.x + (exitPos.x - entryPos.x) * forwardT;
        const z = entryPos.z + (exitPos.z - entryPos.z) * forwardT;
        const y = loopCenterY + heightOffset;
        
        loopPoints.push({
          id: `point-${++pointCounter}`,
          position: new THREE.Vector3(x, y, z),
          tilt: 0
        });
      }
      
      // Combine: points before entry + entry + loop arc + exit + points after exit
      // We keep the entry and exit points, inserting the loop between them
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
