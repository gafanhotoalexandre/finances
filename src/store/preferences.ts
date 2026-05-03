import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type PreferencesStore = {
  nicknames: Record<string, string>
  clearNickname: (userId: string) => void
  setNickname: (userId: string, nickname: string) => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      nicknames: {},
      clearNickname: (userId) => {
        set((state) => {
          const nextNicknames = { ...state.nicknames }
          delete nextNicknames[userId]

          return {
            nicknames: nextNicknames,
          }
        })
      },
      setNickname: (userId, nickname) => {
        set((state) => ({
          nicknames: {
            ...state.nicknames,
            [userId]: nickname,
          },
        }))
      },
    }),
    {
      name: "project-finance-preferences",
      partialize: (state) => ({
        nicknames: state.nicknames,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
)