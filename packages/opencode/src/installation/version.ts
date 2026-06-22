declare global {
  const MTYCODER_VERSION: string
  const MTYCODER_CHANNEL: string
}

export const InstallationVersion = typeof MTYCODER_VERSION === "string" ? MTYCODER_VERSION : "local"
export const InstallationChannel = typeof MTYCODER_CHANNEL === "string" ? MTYCODER_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
