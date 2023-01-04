const express = require("express"),
  bodyParser = require("body-parser"),
  cors = require("cors"),
  { createServer } = require("http"),
  { ApolloServer } = require("@apollo/server"),
  { expressMiddleware } = require("@apollo/server/express4"),
  { WebSocketServer } = require("ws"),
  {
    ApolloServerPluginInlineTrace,
  } = require("@apollo/server/plugin/inlineTrace"),
  { startStandaloneServer } = require("@apollo/server/standalone"),
  { useServer } = require("graphql-ws/lib/use/ws"),
  { makeExecutableSchema } = require("@graphql-tools/schema"),
  {
    ApolloServerPluginDrainHttpServer,
  } = require("@apollo/server/plugin/drainHttpServer");

const typeDefs = `
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => "Hello world!",
  },
};
async function startApolloServer(port) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res) => {
    res.status(200);
    res.send("Hello!");
    res.end();
  });

  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const serverCleanup = useServer({ schema }, wsServer);
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      ApolloServerPluginInlineTrace({
        includeErrors: {
          transform: (err) => (err.message.match(SENSITIVE_REGEX) ? null : err),
        },
      }),
    ],
  });

  const { url } = await startStandaloneServer(server);

  app.use("/graphql", cors(), bodyParser.json(), expressMiddleware(server));
  httpServer.listen(port, () => {
    console.log(`🚀 Server listening at: ${url}`);
  });
}
startApolloServer(3000);
