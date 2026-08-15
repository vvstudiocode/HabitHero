import type { CSSProperties } from 'react';
import type { WorldInputState } from '../input/world-input-types';
import { getJoystickOverlayPosition } from '../input/joystick-layout';

interface DynamicJoystickProps {
  input: WorldInputState;
}

export function DynamicJoystick({ input }: DynamicJoystickProps) {
  const position = getJoystickOverlayPosition(input);
  const isActive = position.mode === 'dynamic';
  const knobOffset = 42;
  const style = position.mode === 'dynamic'
    ? {
      '--hh-joystick-x': `${position.x}px`,
      '--hh-joystick-y': `${position.y}px`,
    } as CSSProperties
    : undefined;
  return (
    <div
      className={`hh-world-joystick hh-world-joystick--fixed${isActive ? ' hh-world-joystick--dynamic' : ''}`}
      data-active={isActive}
      style={style}
      aria-hidden="true"
    >
      <span
        className="hh-world-joystick-knob"
        aria-hidden="true"
        style={{ transform: `translate(${input.joystick.x * knobOffset}px, ${input.joystick.y * knobOffset}px)` }}
      />
    </div>
  );
}
