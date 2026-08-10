import { worldInputReducer } from './world-input-reducer';
import { createInitialWorldInputState, type WorldInputEvent, type WorldInputState } from './world-input-types';

export class PointerInputController {
  private state = createInitialWorldInputState();
  private listeners = new Set<(state: WorldInputState) => void>();

  getSnapshot(): WorldInputState {
    return this.state;
  }

  subscribe(listener: (state: WorldInputState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(event: WorldInputEvent): void {
    this.state = worldInputReducer(this.state, event);
    this.listeners.forEach((listener) => listener(this.state));
  }

  reset(): void {
    this.dispatch({ type: 'reset' });
  }

  consumeCameraDeltas(): Pick<WorldInputState, 'cameraDelta' | 'zoomDelta'> {
    const result = { cameraDelta: this.state.cameraDelta, zoomDelta: this.state.zoomDelta };
    if (result.cameraDelta.x !== 0 || result.cameraDelta.y !== 0 || result.zoomDelta !== 0) {
      this.dispatch({ type: 'clear-camera-delta' });
    }
    return result;
  }
}
