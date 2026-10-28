const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;
// Acepta el token con o sin el prefijo "Token " y sin comillas/espacios sobrantes
const API_TOKEN = (process.env.API_TOKEN || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Token\s+/i, "")
    .trim();

if (!API_TOKEN) {
    console.warn("⚠️ API_TOKEN no está configurado. Las llamadas a la API van a fallar.");
} else {
    console.log(`🔑 API_TOKEN cargado (${API_TOKEN.length} caracteres, termina en ...${API_TOKEN.slice(-4)})`);
}

const AUTH_HEADERS = {
    Authorization: `Token ${API_TOKEN}`,
    "Content-Type": "application/json",
};

const DIAGEO_USUARIOS_URL = "https://botai.smartdataautomation.com/api_backend_ai/dinamic-db/report/119/usuarios_diageo";
const DIAGEO_DATA_URL = "https://botai.smartdataautomation.com/api_backend_ai/dinamic-db/report/119/registro_ubicacion_dieageo";

// Fecha actual en hora de Colombia, solo el día: "YYYY-MM-DDT00:00:00"
function obtenerFechaIngreso() {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const valor = (tipo) => partes.find((p) => p.type === tipo).value;
    return `${valor("year")}-${valor("month")}-${valor("day")}T00:00:00`;
}

app.use(cors());
app.use(express.json());

// ========== ENDPOINT PARA VALIDAR USUARIO ==========
app.get("/api/validar", async (req, res) => {
    try {
        const cedula = req.query.cedula;

        if (!cedula) {
            return res.status(400).json({
                existe: false,
                mensaje: "Cédula no proporcionada"
            });
        }

        console.log(`Validando cédula: ${cedula}`);

        const response = await fetch(DIAGEO_USUARIOS_URL, { headers: AUTH_HEADERS });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`❌ DIAGEO_USUARIOS respondió ${response.status}:`, errorBody);
            throw new Error(`Error al consultar DIAGEO_USUARIOS: ${response.status}`);
        }

        const data = await response.json();

        let usuarioEncontrado = null;

        if (data.result && Array.isArray(data.result)) {
            usuarioEncontrado = data.result.find(usuario =>
                usuario.CEDULA !== undefined && usuario.CEDULA !== null &&
                usuario.CEDULA.toString().trim() === cedula.toString().trim()
            );
        }

        if (usuarioEncontrado) {
            console.log(`✅ Usuario encontrado: ${usuarioEncontrado.CEDULA}`);
            res.json({
                existe: true,
                usuario: usuarioEncontrado
            });
        } else {
            console.log(`❌ Usuario no encontrado: ${cedula}`);
            res.json({
                existe: false,
                mensaje: "Usuario no encontrado"
            });
        }
    } catch (err) {
        console.error("Error en la validación:", err);
        res.status(500).json({
            existe: false,
            error: "Error al validar usuario"
        });
    }
});

// ========== ENDPOINT PARA ENVIAR UBICACIÓN ==========
app.post("/api/enviar-ubicacion", async (req, res) => {
    try {
        const { CEDULA, LATITUD, LONGITUD } = req.body;

        console.log(`📍 Datos recibidos:`, { CEDULA, LATITUD, LONGITUD });

        if (!CEDULA || LATITUD === undefined || LONGITUD === undefined) {
            return res.status(400).json({
                success: false,
                mensaje: "Cédula, latitud o longitud no proporcionada"
            });
        }

        const cedulaString = CEDULA.toString().trim();

        const payload = {
            CEDULA: cedulaString,
            LATITUD: parseFloat(LATITUD),
            LONGITUD: parseFloat(LONGITUD),
            FECHA_INGRESO: obtenerFechaIngreso()
        };

        console.log(`📍 Enviando a Diageo:`, JSON.stringify(payload, null, 2));

        const response = await fetch(DIAGEO_DATA_URL, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify(payload)
        });

        console.log(`📍 Response status:`, response.status);
        const data = await response.json();
        console.log(`📍 Response data:`, JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log(`✅ Ubicación enviada correctamente para: ${cedulaString}`);
            res.json({
                success: true,
                mensaje: "Ubicación enviada correctamente",
                data: data
            });
        } else {
            console.error(`❌ Error al enviar ubicación: ${response.status}`, data);
            res.status(response.status).json({
                success: false,
                error: "Error al enviar ubicación",
                details: data
            });
        }
    } catch (err) {
        console.error("Error al enviar ubicación:", err);
        res.status(500).json({
            success: false,
            error: "Error al enviar ubicación",
            details: err.message
        });
    }
});

// ========== DIAGNÓSTICO DE CONEXIÓN CON LA API ==========
app.get("/api/diagnostico", async (req, res) => {
    const probar = async (url, headers) => {
        try {
            const r = await fetch(url, { headers });
            return { status: r.status, server: r.headers.get("server") };
        } catch (err) {
            return { error: err.message };
        }
    };

    const base = "https://botai.smartdataautomation.com/api_backend_ai/dinamic-db/report/119";
    const resultado = {
        node: process.version,
        token_configurado: Boolean(API_TOKEN),
        usuarios_diageo: await probar(DIAGEO_USUARIOS_URL, AUTH_HEADERS),
        usuarios_nutresa: await probar(`${base}/usuarios_nutresa`, AUTH_HEADERS),
        sin_token: await probar(DIAGEO_USUARIOS_URL, {}),
    };

    console.log("🩺 Diagnóstico:", JSON.stringify(resultado, null, 2));
    res.json(resultado);
});

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ========== DEBUG ==========
app.post("/api/debug", (req, res) => {
    console.log("=== DEBUG DATA ===");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    res.json({
        received: req.body,
        message: "Datos recibidos en debug"
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor proxy escuchando en puerto ${PORT}`);
    console.log(`📍 Endpoints disponibles:`);
    console.log(`   - GET  /api/validar?cedula=XXXXX`);
    console.log(`   - POST /api/enviar-ubicacion`);
    console.log(`   - POST /api/debug`);
    console.log(`   - GET  /health`);
});
