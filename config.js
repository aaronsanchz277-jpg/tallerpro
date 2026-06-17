// config.js

const CONFIG = {
  staging: {
    supabaseUrl: "https://gguytsiobclhsghiyywz.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndXl0c2lvYmNsaHNnaGl5eXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjc1NzksImV4cCI6MjA5NzIwMzU3OX0.WWDPCONo4ruFRZqovjbgmOgG3VKyVACX9zHu1U7NmrI"
  },
  production: {
    supabaseUrl: "https://uggqqmsmxvafeyyinuir.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZ3FxbXNteHZhZmV5eWludWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTIwMTksImV4cCI6MjA4ODc2ODAxOX0.I_ZPk4AHLohodqqZKSuc0w74WSzK3SEpO9CqsYEUjEE"
  }
};

// Si la URL contiene 'github.io' (tu despliegue en producción) usa PRODUCTION.
// Si estás corriendo localmente (localhost / 127.0.0.1) usa STAGING de forma automática.
const isProduction = window.location.hostname.includes('github.io');

export const ENV = isProduction ? CONFIG.production : CONFIG.staging;
