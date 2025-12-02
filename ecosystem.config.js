// ecosystem.config.js (Berada di Root Proyek)

module.exports = {
  apps : [
    // ----------------------------------------
    // 1. Aplikasi Backend: spc-api (data-collector)
    // ----------------------------------------
    {
      name      : 'spc-api-real',
      cwd       : './data-collector', // Lokasi direktori API
      script    : 'server-test.js',  // File yang dieksekusi
      instances : '1',              // Cluster mode: Gunakan semua core CPU
      exec_mode : 'cluster',
      watch     : false,  
      restart_delay: 1000, 
      max_restarts: 20,
      error_file: '../logs/api-err.log',
      out_file  : '../logs/api-out.log',
      
      env: { // Variabel lingkungan Default (Development)
        NODE_ENV: 'development'
      },
      env_production : { // Variabel lingkungan Produksi (Saat dipanggil dengan --env production)
        NODE_ENV: 'production',
        PORT: 3001 
      }
    },

    // ----------------------------------------
    // 2. Aplikasi Backend Dummy: spc-api (data-collector)
    // ----------------------------------------
    {
      name      : 'spc-api-dummy',
      cwd       : './data-collector',
      script    : 'dummy-server.js',
      instances : 1,
      exec_mode : 'cluster',
      watch     : false,
      windowsHide: true,
      restart_delay: 1000,
      max_restarts: 20,
      error_file: '../logs/api-dummy-err.log',
      out_file  : '../logs/api-dummy-out.log',
      env_production : {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },

    // ----------------------------------------
    // 3. Aplikasi Frontend: spc-frontend (Next.js)
    // ----------------------------------------
    {
      name: 'spc-frontend',
      cwd: './web-frontend',
      script: 'cmd.exe',
      args: '/c npm run start',  // <-- Perintah penting agar npm dijalankan oleh CMD
      exec_mode: 'fork',
      watch: false,
      shell: true,

      restart_delay: 1000, 
      // Maksimal coba restart 10 kali
      max_restarts: 20,

      error_file: '../logs/frontend-err.log',
      out_file: '../logs/frontend-out.log',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};