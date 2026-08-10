import type { WorldInputState } from '../input/world-input-types';

interface DynamicJoystickProps {
  input: WorldInputState;
}

export function DynamicJoystick({ input }: DynamicJoystickProps) {
  if (input.joystickPointerId === null || !input.joystickOrigin) return null;
  const knobOffset = 42;
  return (
    <div
      className="hh-world-joystick"
      style={{ left: input.joystickOrigin.x, top: input.joystickOrigin.y }}
      aria-hidden="true"
    >
      <span
        className="hh-world-joystick-knob"
        style={{ transform: `translate(${input.joystick.x * knobOffset}px, ${input.joystick.y * knobOffset}px)` }}
      />
    </div>
  );
}
