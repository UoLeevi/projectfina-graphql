import express from 'express';
import http from 'http';
import { ApolloServer } from 'apollo-server-express';
import schema from './graphql/schema';

const apollo = new ApolloServer({ 
  schema,
  playground: true
});

const app = express();
apollo.applyMiddleware({ app });

const server = http.createServer(app);
apollo.installSubscriptionHandlers(server);

server.listen({ port: 4000 }, () => {
  console.log(
    '🚀 Server ready at',
    `http://localhost:4000${apollo.graphqlPath}`
  );
});
