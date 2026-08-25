/**
 * Camera override used during a space change. `active` blends between the
 * scroll-driven position and this one, so a flight can begin mid-scroll
 * without the camera ever jumping.
 */
export const flight = { active: 0, x: 0, y: 0, z: 0, fov: 0 }

export function resetFlight() {
  flight.active = 0
  flight.x = 0
  flight.y = 0
  flight.z = 0
  flight.fov = 0
}
