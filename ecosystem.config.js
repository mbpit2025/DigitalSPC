// ecosystem.config.js (Berada di Root Proyek)

module.exports = {
  apps : [
    // ----------------------------------------
    // 1. Aplikasi Backend: spc-api (data-collector)
    // ----------------------------------------
    {
      name      : 'spc-api',
      cwd       : './data-collector', // Lokasi direktori API
      script    : 'dummy-server.js',  // File yang dieksekusi
      instances : 'max',              // Cluster mode: Gunakan semua core CPU
      exec_mode : 'cluster',
      watch     : false,              // Matikan watching untuk produksi
      // Opsional: Tambahkan ini jika Anda menggunakan 'import/export' di Node.js
      // node_args : '--experimental-modules', 

      restart_delay: 1000, 
      // Maksimal coba restart 10 kali
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
    // 2. Aplikasi Frontend: spc-frontend (Next.js)
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