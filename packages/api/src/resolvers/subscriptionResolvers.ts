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
      subscribe: () => pubsub.asyncIterator([EVENTS.COLLECTION_JOB_UPDATED]),
    },
    entityUpdated: {
      subscribe: () => pubsub.asyncIterator([EVENTS.ENTITY_UPDATED]),
    },
    alertTriggered: {
      subscribe: () => pubsub.asyncIterator([EVENTS.ALERT_TRIGGERED]),
    },
  },
};
