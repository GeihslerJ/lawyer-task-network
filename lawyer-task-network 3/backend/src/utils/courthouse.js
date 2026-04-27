const courthouseByState = {
  AL: 'Hugo L. Black U.S. Courthouse (Birmingham)',
  AK: 'James M. Fitzgerald U.S. Courthouse (Anchorage)',
  AZ: "Sandra Day O'Connor U.S. Courthouse (Phoenix)",
  AR: 'Richard Sheppard Arnold U.S. Courthouse (Little Rock)',
  CA: 'Ronald Reagan Federal Building and U.S. Courthouse (Santa Ana)',
  CO: 'Byron G. Rogers U.S. Courthouse (Denver)',
  CT: 'Abraham A. Ribicoff Federal Building and Courthouse (Hartford)',
  DC: 'E. Barrett Prettyman U.S. Courthouse (Washington)',
  DE: 'J. Caleb Boggs Federal Building (Wilmington)',
  FL: 'Wilkie D. Ferguson Jr. U.S. Courthouse (Miami)',
  GA: 'Elbert P. Tuttle U.S. Court of Appeals Building (Atlanta)',
  HI: 'Prince Kuhio Federal Building (Honolulu)',
  IA: 'U.S. Courthouse (Des Moines)',
  ID: 'James A. McClure Federal Building and U.S. Courthouse (Boise)',
  IL: 'Dirksen U.S. Courthouse (Chicago)',
  IN: 'Birch Bayh Federal Building and U.S. Courthouse (Indianapolis)',
  KS: 'Robert J. Dole U.S. Courthouse (Kansas City)',
  KY: 'Gene Snyder U.S. Courthouse (Louisville)',
  LA: 'Hale Boggs Federal Building (New Orleans)',
  MA: 'John Joseph Moakley U.S. Courthouse (Boston)',
  MD: 'Edward A. Garmatz U.S. Courthouse (Baltimore)',
  ME: 'Margaret Chase Smith Federal Building (Bangor)',
  MI: 'Theodore Levin U.S. Courthouse (Detroit)',
  MN: 'Warren E. Burger Federal Building and U.S. Courthouse (St. Paul)',
  MO: 'Charles Evans Whittaker Courthouse (Kansas City)',
  MS: 'Thad Cochran U.S. Courthouse (Jackson)',
  MT: 'James F. Battin U.S. Courthouse (Billings)',
  NC: 'Terry Sanford Federal Building and Courthouse (Raleigh)',
  ND: 'William L. Guy Federal Building (Bismarck)',
  NE: 'Roman L. Hruska U.S. Courthouse (Omaha)',
  NH: 'Warren B. Rudman U.S. Courthouse (Concord)',
  NJ: 'Martin Luther King Jr. Federal Building and Courthouse (Newark)',
  NM: 'Pete V. Domenici U.S. Courthouse (Albuquerque)',
  NV: 'Lloyd D. George U.S. Courthouse (Las Vegas)',
  NY: 'Thurgood Marshall U.S. Courthouse (New York)',
  OH: 'Carl B. Stokes U.S. Courthouse (Cleveland)',
  OK: 'William J. Holloway Jr. U.S. Courthouse (Oklahoma City)',
  OR: 'Mark O. Hatfield U.S. Courthouse (Portland)',
  PA: 'James A. Byrne U.S. Courthouse (Philadelphia)',
  RI: 'John O. Pastore Federal Building (Providence)',
  SC: 'Matthew J. Perry Jr. U.S. Courthouse (Columbia)',
  SD: 'Andrew W. Bogue Federal Building and U.S. Courthouse (Rapid City)',
  TN: 'Fred D. Thompson U.S. Courthouse (Nashville)',
  TX: 'Bob Casey U.S. Courthouse (Houston)',
  UT: 'Orrin G. Hatch U.S. Courthouse (Salt Lake City)',
  VA: 'Spottswood W. Robinson III and Robert R. Merhige Jr. U.S. Courthouse (Richmond)',
  VT: 'Federal Building and U.S. Courthouse (Burlington)',
  WA: 'William Kenzo Nakamura U.S. Courthouse (Seattle)',
  WI: 'Milwaukee Federal Courthouse (Milwaukee)',
  WV: 'Sidney L. Christie U.S. Courthouse (Charleston)',
  WY: 'Ewing T. Kerr Federal Building and U.S. Courthouse (Casper)',
};

export const COURTHOUSE_OPTIONS = Object.freeze(
  [...new Set(Object.values(courthouseByState))].sort((a, b) => a.localeCompare(b))
);

export function isValidCourthouse(courthouse) {
  return COURTHOUSE_OPTIONS.includes((courthouse || '').trim());
}

export function getNearestCourthouse(stateInput) {
  const value = (stateInput || '').trim();
  if (!value) return COURTHOUSE_OPTIONS[0];

  const state = value.length === 2 ? value.toUpperCase() : value;

  if (courthouseByState[state]) {
    return courthouseByState[state];
  }

  const maybeCode = Object.keys(courthouseByState).find((code) => {
    return code.toLowerCase() === value.toLowerCase();
  });

  if (maybeCode) {
    return courthouseByState[maybeCode];
  }

  return COURTHOUSE_OPTIONS[0];
}
