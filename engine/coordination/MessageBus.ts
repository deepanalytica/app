// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Message Bus
// High-performance async communication layer between agents
// ============================================================

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentRole, MessageType } from '../models/types';

type MessageHandler = (message: AgentMessage) => void | Promise<void>;

interface Subscription {
  id: string;
  subscriber: AgentRole | 'orchestrator' | 'system';
  messageTypes: MessageType[];
  handler: MessageHandler;
}

export class MessageBus extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private messageHistory: AgentMessage[] = [];
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // Subscribe to messages
  subscribe(
    subscriber: AgentRole | 'orchestrator' | 'system',
    messageTypes: MessageType[],
    handler: MessageHandler
  ): string {
    const subId = uuidv4();
    this.subscriptions.set(subId, {
      id: subId,
      subscriber,
      messageTypes,
      handler,
    });
    return subId;
  }

  // Unsubscribe
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  // Publish a message
  async publish(
    from: AgentRole | 'orchestrator' | 'system',
    to: AgentRole | 'orchestrator' | 'all',
    type: MessageType,
    payload: Record<string, unknown>,
    priority: AgentMessage['priority'] = 'normal',
    correlationId?: string
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: uuidv4(),
      type,
      from,
      to,
      timestamp: new Date(),
      payload,
      priority,
      correlationId,
    };

    // Store in history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Deliver to subscribers
    const deliveryPromises: Promise<void>[] = [];

    for (const sub of this.subscriptions.values()) {
      if (!sub.messageTypes.includes(type)) continue;

      const isAddressed =
        to === 'all' || sub.subscriber === to || sub.subscriber === from;
      if (!isAddressed) continue;

      deliveryPromises.push(
        Promise.resolve(sub.handler(message)).catch((err) => {
          console.error(`[MessageBus] Handler error for ${sub.subscriber}:`, err);
        })
      );
    }

    // High-priority messages are awaited; others fire-and-forget
    if (priority === 'critical' || priority === 'high') {
      await Promise.all(deliveryPromises);
    } else {
      Promise.all(deliveryPromises).catch(console.error);
    }

    // Emit for external listeners (WebSocket bridge)
    this.emit('message', message);

    return message;
  }

  // Broadcast to all agents
  async broadcast(
    from: AgentRole | 'orchestrator' | 'system',
    type: MessageType,
    payload: Record<string, unknown>
  ): Promise<AgentMessage> {
    return this.publish(from, 'all', type, payload, 'normal');
  }

  // Wait for a specific response
  waitForResponse(
    correlationId: string,
    fromAgent: AgentRole,
    timeoutMs = 120_000
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('message', handler);
        reject(new Error(`Timeout waiting for response from ${fromAgent} (correlationId: ${correlationId})`));
      }, timeoutMs);

      const handler = (msg: AgentMessage) => {
        if (msg.correlationId === correlationId && msg.from === fromAgent) {
          clearTimeout(timer);
          this.removeListener('message', handler);
          resolve(msg);
        }
      };

      this.on('message', handler);
    });
  }

  getHistory(
    filter?: Partial<Pick<AgentMessage, 'type' | 'from' | 'to'>>
  ): AgentMessage[] {
    if (!filter) return [...this.messageHistory];

    return this.messageHistory.filter((msg) => {
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to) return false;
      return true;
    });
  }

  getStats() {
    return {
      totalMessages: this.messageHistory.length,
      subscribers: this.subscriptions.size,
      byType: this.messageHistory.reduce(
        (acc, msg) => {
          acc[msg.type] = (acc[msg.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  clear(): void {
    this.subscriptions.clear();
    this.messageHistory = [];
  }
}

// Singleton instance
export const messageBus = new MessageBus();
