import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
  from,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { createClient } from 'graphql-ws';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/graphql`,
    connectionParams: () => {
      const token = localStorage.getItem('auth_token');
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

const authLink = setContext((_, { headers }: { headers?: Record<string, string> }) => {
  const token = localStorage.getItem('auth_token');
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      console.error(`[GraphQL Error]: ${err.message}`, err.path);
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
  }
  if (networkError) {
    console.error(`[Network Error]: ${networkError.message}`);
  }
});

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink])
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          searchEntities: {
            keyArgs: ['query', 'types', 'sources'],
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      Entity: {
        keyFields: ['id'],
      },
      Case: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
