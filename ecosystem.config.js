module.exports = {
  apps: [{
    name: 'api-minuteserv',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/api.minuteserve.com',
    env_file: '.env',
    env: {
      NODE_ENV: 'development'
    },
    error_file: '/root/.pm2/logs/api-minuteserv-error.log',
    out_file: '/root/.pm2/logs/api-minuteserv-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
