module.exports = {
  apps: [
    {
      name: 'spc-api',
      cwd: './data-collector',
      script: 'server-test.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      restart_delay: 1000,
      max_restarts: 20,

      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',

      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },

    {
      name: 'spc-frontend',
      cwd: './web-frontend',
      script: 'npm',
      args: 'run start',
      exec_mode: 'fork',
      watch: false,
      restart_delay: 1000,
      max_restarts: 20,

      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
