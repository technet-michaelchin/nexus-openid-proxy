import express from "express";
import pino from "pino";
import { auth, Session } from "express-openid-connect";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import http from "http";
import httpProxy from "http-proxy";
import randomstring from "randomstring";
import {
  CreateNexusUserPayload,
  CustomJWTPayload,
  NexusUser,
} from "./dto/nexus";
import "core-js/stable/atob";

const server = express();
const proxy = httpProxy.createProxyServer({ ws: true });
const httpServer = http.createServer(server);

const port = process.env.PORT || 3000;
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});
// authentication
const NexusClient = axios.create({
  baseURL: `https://${process.env.NEXUS_HOST}/service/rest/v1`,
  auth: {
    username: process.env.NEXUS_USERNAME,
    password: process.env.NEXUS_PASSWORD,
  },
});

// search the nexus user by userId
// if user is not exist, create a new user in nexus
async function createUserIfNotExist(
  userId: string,
  createUserPayload: CreateNexusUserPayload
) {
  const resp = await NexusClient.get(`/security/users?userId=${userId}`);
  const users: Array<NexusUser> = resp.data;
  var found = false;
  for (const user of users) {
    if (user.userId === userId) {
      found = true;
      break;
    }
  }
  if (!found) {
    const resp = await NexusClient.post("/security/users", createUserPayload);
    if (resp.status !== 200) {
      logger.error(
        `Failed to create user ${userId} with payload ${createUserPayload}, response: ${resp.status} ${resp.statusText} ${resp.data}`
      );
      throw new Error("Failed to create user in Nexus");
    }
  }
}

server.enable("trust proxy");
server.use(
  auth({
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET,
    idpLogout: true,
    afterCallback: async (
      req,
      res,
      session,
      decodedState
    ): Promise<Session> => {
      const jwt: CustomJWTPayload = jwtDecode(session.id_token);
      // fetch the role from the token
      // @ts-ignore
      var roles: Array<string> = jwt.resource_access?.nexus3?.roles;
      if (roles == null || roles == undefined || roles.length == 0) {
        roles = ["test"];
      }
      try {
        await createUserIfNotExist(jwt.email, {
          userId: jwt.email,
          firstName: jwt.given_name,
          lastName: jwt.family_name,
          emailAddress: jwt.email,
          password: randomstring.generate(16),
          status: "active",
          roles: roles,
        });
        // TODO: sync the roles between nexus and keycloak
        return session;
      } catch (e) {
        logger.error(`Failed to create user in Nexus: ${e}`);
        res.sendStatus(500);
      }
    },
  })
);

server.all("/*", async (req, res) => {
  req.headers.host = process.env.NEXUS_HOST;
  req.headers["X-SSO-USER"] = req.oidc.user.email;
  // console.log(req.headers);
  proxy.web(
    req,
    res,
    {
      target: `https://${process.env.NEXUS_HOST}`,
      secure: false,
    },
    (e) => {
      logger.error(`Failed to proxy request: ${e}`);
    }
  );
});

httpServer.listen(port, (err?: any) => {
  return logger.info(`Proxy is running on port ${port}'`);
});
