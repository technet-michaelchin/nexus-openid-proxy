import { JwtPayload } from "jwt-decode";

export interface CreateNexusUserPayload {
  userId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  status: string;
  roles: string[];
}

export interface NexusUser {
  userId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  source: string;
  status: string;
  readOnly: boolean;
  roles: string[];
  externalRoles: string[];
}

export interface CustomJWTPayload extends JwtPayload {
  email: string;
  given_name: string;
  family_name: string;
}
