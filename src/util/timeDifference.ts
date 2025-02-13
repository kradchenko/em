/** Returns the difference in seconds between two timestamps (milliseconds). */
const timeDifference = (timestamp1: string, timestamp2: string) =>
  Math.floor((new Date(timestamp1).getTime() - new Date(timestamp2).getTime()) / 1000)

export default timeDifference
