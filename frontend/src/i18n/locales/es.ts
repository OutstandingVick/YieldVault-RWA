/**
 * Spanish message catalog (same key structure as English).
 */
export const es = {
  app: {
    loading: {
      title: "Cargando...",
      subtitle: "Asegurando la conexión RWA",
    },
    errorBoundary:
      "Se produjo un error. Nuestro equipo ha sido notificado.",
  },
  nav: {
    brand: {
      primary: "YieldVault",
      accent: "RWA",
    },
    vaults: "Bóvedas",
    portfolio: "Portafolio",
    analytics: "Analítica",
  },
  theme: {
    toggleToDark: "Cambiar al modo oscuro",
    toggleToLight: "Cambiar al modo claro",
  },
  wallet: {
    connecting: "Conectando...",
    connectFreighter: "Conectar Freighter",
    rpcPrefix: "RPC:",
    rpcCustom: "Personalizado",
    rpcDefault: "Predeterminado",
    disconnectAria: "Desconectar billetera",
    errors: {
      retry: "Intentar de nuevo",
      dismissAria: "Descartar error de conexión de billetera",
      notInstalled: {
        title: "Freighter no está instalado",
        description:
          "Instala la extensión Freighter, actualiza esta página e intenta conectar de nuevo.",
      },
      permissionDenied: {
        title: "Permiso de billetera requerido",
        description:
          "Aprueba YieldVault en Freighter e intenta conectar de nuevo.",
      },
      userRejected: {
        title: "Conexión cancelada",
        description:
          "Rechazaste la solicitud de conexión de Freighter. Puedes intentarlo cuando quieras.",
      },
      noAddress: {
        title: "No se obtuvo dirección",
        description:
          "Freighter no devolvió una clave pública para esta sesión. Desbloquea Freighter e inténtalo de nuevo.",
      },
      disconnectedExternally: {
        title: "Billetera desconectada",
        description:
          "Freighter ya no está conectado a esta sesión. Vuelve a conectar para continuar.",
      },
      unknown: {
        title: "Falló la conexión de la billetera",
        description:
          "Asegúrate de que Freighter esté instalado, desbloqueado y aprobado para este sitio.",
      },
    },
  },
  toast: {
    walletConnected: {
      title: "Billetera conectada",
      description:
        "Freighter está conectado a tu sesión de YieldVault.",
    },
    walletPermissionRequired: {
      title: "Permiso de billetera requerido",
      description:
        "Freighter no devolvió una clave pública para esta sesión.",
    },
    walletConnectionFailed: {
      title: "Falló la conexión de la billetera",
      description:
        "Asegúrate de que Freighter esté instalado, desbloqueado y aprobado para este sitio.",
    },
    walletDisconnected: {
      title: "Billetera desconectada",
      description:
        "Puedes volver a conectar en cualquier momento para seguir gestionando posiciones en la bóveda.",
    },
    walletDisconnectedExternal: {
      title: "Billetera desconectada",
      description: "Freighter ya no está conectado a esta sesión.",
    },
  },
  apiBanner: {
    title: "Datos no disponibles",
  },
  dataTable: {
    pageLabel: "Página",
    pageOf: "de",
    previous: "Anterior",
    next: "Siguiente",
    sortBy: "Ordenar por",
  },
  shortcuts: {
    title: "Atajos de teclado",
    close: "Cerrar",
    hint: "Presiona Esc para cerrar este diálogo",
  },
  refresh: {
    live: "En vivo",
    stopped: "Detenido",
    pause: "Pausar",
    resume: "Reanudar",
    refreshNow: "Actualizar",
    refreshing: "Actualizando...",
    justNow: "Ahora",
    oneMinuteAgo: "Hace 1 min",
    minutesAgo: "min atrás",
    pausedHidden: "Pausado (pestaña oculta)",
    pausedOffline: "Pausado (sin conexión)",
    pausedManual: "Pausado",
  },
} as const;
