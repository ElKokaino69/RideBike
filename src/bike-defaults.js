// RideBike – Standard-Radprofil
// © 2026 Florian Enders

export const DEFAULT_BIKE = {
  type: 'trekking',
  riderKg: 80,
  bikeKg: 16,
  luggageKg: 0,
  power: 110,          // Dauerleistung Fahrer (W)
  support: 0,          // Motorunterstützung (W), 0 = ohne Motor
  maxSpeed: 40,        // km/h
  tyre: 'allround',
  aero: 'upright',
  avoidTraffic: false,
  preferCycleRoutes: false,
  avoidSteep: false,
  avoidSteps: false,
  preferUnpaved: false
};
