/**
 * The "paper tossed onto a table" motion, as a pure function of progress.
 * 0..FALL: the cutout falls toward the table (it starts closer to the camera,
 * so bigger, further off its resting spot, with a wide soft shadow).
 * FALL..1: impact squash, then a small damped settle / wobble.
 */
export interface DropPose {
  visible: boolean;
  /** Offset from the resting position, px. */
  dx: number;
  dy: number;
  /** Extra rotation on top of the resting rotation, radians. */
  rot: number;
  scale: number;
  /** 0 = lying flat on the table, 1 = high above it. Drives the shadow. */
  lift: number;
}

const FALL = 0.55;

export interface DropFlavor {
  /** Unit direction the cutout comes from. */
  fromX: number;
  fromY: number;
  /** Distance it travels, px. */
  distance: number;
  /** Rotation it sheds on the way down, radians. */
  spin: number;
}

export const REST_POSE: DropPose = { visible: true, dx: 0, dy: 0, rot: 0, scale: 1, lift: 0 };

export function dropPose(progress: number, flavor: DropFlavor): DropPose {
  if (progress < 0) return { visible: false, dx: 0, dy: 0, rot: 0, scale: 1, lift: 1 };
  if (progress >= 1) return REST_POSE;
  if (progress < FALL) {
    const u = progress / FALL;
    const remaining = 1 - u * u; // gravity: ease-in
    return {
      visible: true,
      dx: flavor.fromX * flavor.distance * remaining,
      dy: flavor.fromY * flavor.distance * remaining,
      rot: flavor.spin * remaining,
      scale: 1 + 0.32 * remaining,
      lift: remaining,
    };
  }
  const u = (progress - FALL) / (1 - FALL);
  const decay = Math.exp(-4 * u);
  const wave = Math.cos(u * Math.PI * 3);
  return {
    visible: true,
    dx: 0,
    dy: 0,
    rot: -flavor.spin * 0.06 * decay * wave,
    // squash on impact, a little rebound, then rest
    scale: 1 - 0.035 * decay * wave,
    lift: Math.max(0, 0.05 * decay * -wave),
  };
}
