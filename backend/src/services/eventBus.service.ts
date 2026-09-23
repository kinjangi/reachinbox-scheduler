import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners if many dashboard tabs are open concurrently
    this.setMaxListeners(50);
  }

  emitUpdate(type: 'email_status_update' | 'email_scheduled', payload: any) {
    this.emit('update', { type, data: payload, timestamp: new Date().toISOString() });
  }
}

export const eventBus = new EventBus();
