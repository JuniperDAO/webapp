interface UserTracker {
    setUserID: (id: string) => void
    // other methods...
}

declare var tracker: UserTracker
