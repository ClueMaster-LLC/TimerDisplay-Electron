import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

const useAppStore = create(
  subscribeWithSelector((set, get) => ({
    // backend data (read-only, synced from electron-store)
    data: {},

    // game control state (client-side only)
    timer: {
      time: 300,
      initialTime: 300,
      paused: false,
      setTime: null, // trigger for direct time setting
      gameEndTime: null, // store the game end time for real-time calculation
    },

    overlay: {
      visible: false,
      position: "vertical-left",
      theme: "yellow",
    },

    clue: {
      isActive: false,
      type: null,
      src: null,
      data: null,
    },

    actions: {
      // timer actions
      setTimerTime: (time) => {
        console.log("📊 STORE: setTimerTime called with:", time);
        set((state) => ({
          timer: {
            ...state.timer,
            time,
            initialTime: time,
            setTime: time,
          },
        }));
        // clear trigger after brief moment
        setTimeout(() => {
          set((state) => ({
            timer: { ...state.timer, setTime: null },
          }));
        }, 100);
      },

      setGameEndTime: (gameEndTime) => {
        set((state) => ({
          timer: {
            ...state.timer,
            gameEndTime,
          },
        }));
      },

      pauseTimer: () => {
        set((state) => ({
          timer: { ...state.timer, paused: true },
        }));
      },

      resumeTimer: () => {
        set((state) => ({
          timer: { ...state.timer, paused: false },
        }));
      },

      // overlay actions
      setOverlayVisible: (visible) => {
        set((state) => ({
          overlay: { ...state.overlay, visible },
        }));
      },

      setCluePosition: (position) => {
        set((state) => ({
          overlay: { ...state.overlay, position },
        }));
      },

      setClueTheme: (theme) => {
        set((state) => ({
          overlay: { ...state.overlay, theme },
        }));
      },

      // clue actions
      showClue: (type, src, data = null) => {
        set((state) => ({
          clue: {
            isActive: true,
            type,
            src,
            data,
          },
        }));
      },

      hideClue: () => {
        set((state) => ({
          clue: {
            isActive: false,
            type: null,
            src: null,
            data: null,
          },
        }));
      },
    },

    // store sync methods (internal)
    _updateStore: (key, value) => {
      set((state) => ({
        data: { ...state.data, [key]: value },
      }));
    },

    _initializeStore: (allData) => {
      set({ data: { ...allData } });
    },

    getValue: (key) => get().data[key],
    getValueOr: (key, fallback) => {
      const data = get().data;
      return key in data ? data[key] : fallback;
    },
  }))
);

// store sync system
let isInitialized = false;
let unsubscribeFromChanges = null;

export const initializeStoreSync = async () => {
  if (isInitialized) return;

  try {
    const allData = await window.StoreBackend.getAll();
    useAppStore.getState()._initializeStore(allData);

    unsubscribeFromChanges = window.StoreBackend.onChange((key, value) => {
      useAppStore.getState()._updateStore(key, value);
    });

    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize store sync:", error);
  }
};

export const cleanupStoreSync = () => {
  if (unsubscribeFromChanges) {
    unsubscribeFromChanges();
    unsubscribeFromChanges = null;
  }
  isInitialized = false;
};

export const useStoreValue = (key, fallback) => {
  return useAppStore((state) => {
    const data = state.data;
    return key in data ? data[key] : fallback;
  });
};

export const useGameActions = () => {
  return useAppStore((state) => state.actions);
};

export const useTimerState = () => {
  return useAppStore((state) => state.timer);
};

export const useOverlayState = () => {
  return useAppStore((state) => state.overlay);
};

export const useClueState = () => {
  return useAppStore((state) => state.clue);
};

export default useAppStore;
