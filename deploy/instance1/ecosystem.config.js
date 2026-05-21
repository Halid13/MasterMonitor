// PM2 ecosystem – MasterMonitor Instance 1
// Usage : pm2 start ecosystem.config.js
//         pm2 reload ecosystem.config.js   (redémarrage sans coupure)

module.exports = {
  apps: [
    {
      name: 'mastermonitor-1',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/mastermonitor',

      // Charge les variables depuis .env.local du répertoire de travail
      env_file: '/opt/mastermonitor/.env.local',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Redémarrage automatique en cas de crash
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Logs
      out_file: '/var/log/mastermonitor/instance1-out.log',
      error_file: '/var/log/mastermonitor/instance1-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
