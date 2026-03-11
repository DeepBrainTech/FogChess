/**
 * NotificationService – future in-app / push notification layer (not wired).
 * Planned for: opponent move alerts, invite acceptance, draw/undo requests, etc.
 * Can later integrate with Socket.io rooms, or external push (web push, FCM, etc.).
 */

/** Priority for ordering / filtering notifications */
export type NotificationPriority = 'low' | 'normal' | 'high';

export type NotificationType =
  | 'move'
  | 'invite'
  | 'invite_accepted'
  | 'draw_request'
  | 'undo_request'
  | 'game_over';

export interface NotificationPayload {
  type: NotificationType;
  userId?: number;
  roomId?: string;
  gameId?: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
}

/** Stored notification (for future persistence / history) */
export interface StoredNotification extends NotificationPayload {
  id?: string;
  createdAt?: number;
}

export class NotificationService {
  private _enabled = false;
  private _defaultPriority: NotificationPriority = 'normal';

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /** Send notification to a specific user (by socket id or user id) */
  async notifyUser(userId: number, payload: NotificationPayload): Promise<void> {
    if (!this._enabled) return;
    // TODO: resolve userId -> socket ids, emit via Socket.io
    void userId;
    void payload;
  }

  /** Notify all users in a room */
  async notifyRoom(roomId: string, payload: NotificationPayload): Promise<void> {
    if (!this._enabled) return;
    // TODO: get room sockets, emit to room
    void roomId;
    void payload;
  }

  /** Convenience: opponent made a move */
  async notifyMove(roomId: string, userId: number, moveNotation?: string): Promise<void> {
    await this.notifyRoom(roomId, {
      type: 'move',
      userId,
      roomId,
      data: { move: moveNotation },
    });
  }

  /** Set default priority for outgoing notifications */
  setDefaultPriority(priority: NotificationPriority): void {
    this._defaultPriority = priority;
  }

  getDefaultPriority(): NotificationPriority {
    return this._defaultPriority;
  }

  /**
   * Batch notify multiple users. Future use: e.g. broadcast to lobby.
   * Not wired – returns immediately.
   */
  async notifyUsers(userIds: number[], payload: NotificationPayload): Promise<void> {
    if (!this._enabled || !userIds.length) return;
    for (const uid of userIds) {
      await this.notifyUser(uid, payload);
    }
  }

  /** Placeholder: persist notification for later retrieval (e.g. offline users) */
  async _persist(_payload: StoredNotification): Promise<void> {
    // TODO: store to DB or Redis list for user notification history
  }
}

export const notificationService = new NotificationService();
