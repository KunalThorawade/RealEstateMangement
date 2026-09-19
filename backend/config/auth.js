module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretkey',
  SUPER_SECRET_KEY: process.env.SUPER_SECRET_KEY || 'topsecret123',
  ROLES: {
    ADMIN:  'admin',
    TENANT: 'tenant',
    STAFF:  'staff'
  }

};
