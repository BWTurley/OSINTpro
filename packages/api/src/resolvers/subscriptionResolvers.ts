import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const EVENTS = {
  COLLECTION_JOB_UPDATED: 'COLLECTION_JOB_UPDATED',
  ENTITY_UPDATED: 'ENTITY_UPDATED',
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',
} as const;

export const subscriptionResolvers = {
  Subscription: {
    collectionJobUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.COLLECTION_JOB_UPDATED]),
    },
    entityUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.ENTITY_UPDATED]),
    },
    alertTriggered: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.ALERT_TRIGGERED]),
    },
  },
};
