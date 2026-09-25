const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

const PORT = 3000;
const HOST = '0.0.0.0';

/* =========================================================
   SERVIDOR DE VIDEOS / CLOUDFLARE

   CUANDO CLOUDFLARE CAMBIE:
   CAMBIA SOLAMENTE ESTA URL
========================================================= */

const VIDEO_SERVER =
    'https://releases-handmade-more-bracelet.trycloudflare.com';


const DATA_DIR = path.join(__dirname, 'data');
const DATABASE_FILE = path.join(DATA_DIR, 'database.json');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));


/* =========================================================
   PRISMA PLAY
   PÁGINA PRINCIPAL
========================================================= */

app.get('/', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'home.html'
        )
    );

});


/* =========================================================
   BASE DE DATOS
========================================================= */

const DEFAULT_DATABASE = {

    movies: {

        moana: {

            likes: 25,

            dislikes: 4,

            voters: {}

        },

        minions: {

            likes: 81,

            dislikes: 7,

            voters: {}

        },

        monsters: {

            likes: 42,

            dislikes: 3,

            voters: {}

        }

    }

};


/* =========================================================
   ASEGURAR BASE DE DATOS
========================================================= */

function ensureDatabase() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

    if (!fs.existsSync(DATABASE_FILE)) {

        saveDatabase(
            DEFAULT_DATABASE
        );

        return;

    }

    try {

        const database =
            readDatabase();

        if (
            !database.movies ||
            typeof database.movies !== 'object'
        ) {

            saveDatabase(
                DEFAULT_DATABASE
            );

        }

    } catch (error) {

        console.error(
            '[DATABASE] Archivo inválido. Recreando...'
        );

        saveDatabase(
            DEFAULT_DATABASE
        );

    }

}


/* =========================================================
   LEER BASE DE DATOS
========================================================= */

function readDatabase() {

    const content =
        fs.readFileSync(
            DATABASE_FILE,
            'utf8'
        );

    /*
        PROTECCIÓN:

        Si database.json está vacío,
        evita el error:

        Unexpected end of JSON input
    */

    if (!content.trim()) {

        console.warn(
            '[DATABASE] database.json estaba vacío. Recreando...'
        );

        saveDatabase(
            DEFAULT_DATABASE
        );

        return JSON.parse(
            JSON.stringify(
                DEFAULT_DATABASE
            )
        );

    }

    try {

        return JSON.parse(
            content
        );

    } catch (error) {

        console.error(
            '[DATABASE] JSON corrupto. Recreando...',
            error
        );

        saveDatabase(
            DEFAULT_DATABASE
        );

        return JSON.parse(
            JSON.stringify(
                DEFAULT_DATABASE
            )
        );

    }

}


/* =========================================================
   GUARDAR BASE DE DATOS
========================================================= */

function saveDatabase(database) {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            database,
            null,
            4
        ),
        'utf8'
    );

}


/* =========================================================
   NORMALIZACIÓN
========================================================= */

function normalizeMovieId(value) {

    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9_-]/g,
            ''
        );

}


function normalizeUserId(value) {

    return String(value || '')
        .trim()
        .slice(
            0,
            200
        );

}


/* =========================================================
   OBTENER PELÍCULA
========================================================= */

function getMovie(
    database,
    movieId
) {

    if (
        !database.movies
    ) {

        database.movies = {};

    }

    if (
        !database.movies[movieId]
    ) {

        database.movies[movieId] = {

            likes: 0,

            dislikes: 0,

            voters: {}

        };

    }

    const movie =
        database.movies[movieId];

    if (
        typeof movie.likes !==
        'number'
    ) {

        movie.likes = 0;

    }

    if (
        typeof movie.dislikes !==
        'number'
    ) {

        movie.dislikes = 0;

    }

    if (
        !movie.voters ||
        typeof movie.voters !==
        'object'
    ) {

        movie.voters = {};

    }

    return movie;

}


/* =========================================================
   ESTADO DEL SERVIDOR
========================================================= */

app.get(
    '/api/status',
    (req, res) => {

        res.json({

            success: true,

            server: 'online',

            port: PORT,

            time:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   SERVIDOR DE VIDEOS

   TODAS LAS PÁGINAS DE PELÍCULAS PUEDEN CONSULTAR:

   /api/video-server
========================================================= */

app.get(
    '/api/video-server',
    (req, res) => {

        res.json({

            success: true,

            url: VIDEO_SERVER

        });

    }
);


/* =========================================================
   OBTENER VOTOS
========================================================= */

app.get(
    '/api/movie/:movieId/votes',
    (req, res) => {

        try {

            const movieId =
                normalizeMovieId(
                    req.params.movieId
                );

            const userId =
                normalizeUserId(
                    req.query.user
                );

            if (!movieId) {

                return res.status(400).json({

                    success: false,

                    message:
                        'ID de película inválido.'

                });

            }

            const database =
                readDatabase();

            const movie =
                getMovie(
                    database,
                    movieId
                );

            const userVote =
                userId
                    ? (
                        movie.voters[userId] ||
                        null
                    )
                    : null;

            res.json({

                success: true,

                movieId,

                likes:
                    movie.likes,

                dislikes:
                    movie.dislikes,

                userVote

            });

        } catch (error) {

            console.error(
                '[VOTOS] ERROR GET:',
                error
            );

            res.status(500).json({

                success: false,

                message:
                    'Error interno obteniendo los votos.'

            });

        }

    }
);


/* =========================================================
   REGISTRAR VOTO
========================================================= */

app.post(
    '/api/movie/:movieId/vote',
    (req, res) => {

        try {

            const movieId =
                normalizeMovieId(
                    req.params.movieId
                );

            const vote =
                String(
                    req.body?.vote || ''
                )
                    .trim()
                    .toLowerCase();

            const userId =
                normalizeUserId(
                    req.body?.user
                );

            if (!movieId) {

                return res.status(400).json({

                    success: false,

                    message:
                        'ID de película inválido.'

                });

            }

            if (
                vote !== 'like' &&
                vote !== 'dislike'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'El voto debe ser like o dislike.'

                });

            }

            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Falta el identificador del dispositivo.'

                });

            }

            const database =
                readDatabase();

            const movie =
                getMovie(
                    database,
                    movieId
                );

            const previousVote =
                movie.voters[userId] ||
                null;


            /* =================================================
               MISMO VOTO
            ================================================= */

            if (
                previousVote === vote
            ) {

                return res.json({

                    success: true,

                    changed: false,

                    likes:
                        movie.likes,

                    dislikes:
                        movie.dislikes,

                    userVote:
                        previousVote

                });

            }


            /* =================================================
               QUITAR VOTO ANTERIOR
            ================================================= */

            if (
                previousVote === 'like'
            ) {

                movie.likes =
                    Math.max(
                        0,
                        movie.likes - 1
                    );

            } else if (
                previousVote === 'dislike'
            ) {

                movie.dislikes =
                    Math.max(
                        0,
                        movie.dislikes - 1
                    );

            }


            /* =================================================
               AGREGAR NUEVO VOTO
            ================================================= */

            if (
                vote === 'like'
            ) {

                movie.likes += 1;

            } else {

                movie.dislikes += 1;

            }

            movie.voters[userId] =
                vote;

            saveDatabase(
                database
            );

            console.log(
                `[VOTOS] ${movieId} | ` +
                `${userId}: ` +
                `${previousVote || 'ninguno'} -> ${vote}`
            );

            res.json({

                success: true,

                changed: true,

                likes:
                    movie.likes,

                dislikes:
                    movie.dislikes,

                userVote:
                    vote

            });

        } catch (error) {

            console.error(
                '[VOTOS] ERROR POST:',
                error
            );

            res.status(500).json({

                success: false,

                message:
                    'Error interno registrando el voto.'

            });

        }

    }
);


/* =========================================================
   ESTADÍSTICAS
========================================================= */

app.get(
    '/api/stats',
    (req, res) => {

        try {

            const database =
                readDatabase();

            const stats = {};

            for (
                const movieId of
                Object.keys(
                    database.movies
                )
            ) {

                const movie =
                    getMovie(
                        database,
                        movieId
                    );

                stats[movieId] = {

                    likes:
                        movie.likes,

                    dislikes:
                        movie.dislikes,

                    voters:
                        Object.keys(
                            movie.voters
                        ).length

                };

            }

            res.json({

                success: true,

                stats

            });

        } catch (error) {

            console.error(
                '[STATS] ERROR:',
                error
            );

            res.status(500).json({

                success: false,

                message:
                    'Error obteniendo estadísticas.'

            });

        }

    }
);


/* =========================================================
   CHAT / OLLAMA
========================================================= */

app.post(
    '/api/chat',
    async (req, res) => {

        try {

            const prompt =
                String(
                    req.body?.prompt || ''
                ).trim();

            if (!prompt) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Falta el prompt.'

                });

            }

            const response =
                await fetch(
                    'http://127.0.0.1:11434/api/generate',
                    {

                        method: 'POST',

                        headers: {

                            'Content-Type':
                                'application/json'

                        },

                        body:
                            JSON.stringify({

                                model:
                                    'qwen3:8b',

                                prompt,

                                stream: false

                            })

                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Ollama respondió ${response.status}`
                );

            }

            const data =
                await response.json();

            res.json({

                success: true,

                response:
                    data.response || ''

            });

        } catch (error) {

            console.error(
                '[CHAT] ERROR:',
                error
            );

            res.status(500).json({

                success: false,

                message:
                    'No se pudo conectar con Ollama.',

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                'Ruta no encontrada.',

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   MANEJO DE ERRORES
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            '[SERVER] ERROR:',
            error
        );

        res.status(500).json({

            success: false,

            message:
                'Error interno del servidor.'

        });

    }
);


/* =========================================================
   INICIAR BASE DE DATOS
========================================================= */

ensureDatabase();


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

app.listen(
    PORT,
    HOST,
    () => {

        console.log('');

        console.log(
            '========================================'
        );

        console.log(
            '      PRISMA PLAY SERVER'
        );

        console.log(
            '========================================'
        );

        console.log(
            `Servidor iniciado en http://localhost:${PORT}`
        );

        console.log(
            'Página principal: /home.html'
        );

        console.log(
            'Sistema de votos: ACTIVO'
        );

        console.log(
            'Votos por dispositivo: ACTIVO'
        );

        console.log(
            'Base de datos: data/database.json'
        );

        console.log(
            'Ollama API: ACTIVA'
        );

        console.log(
            `Servidor de videos: ${VIDEO_SERVER}`
        );

        console.log(
            'API servidor de videos: /api/video-server'
        );

        console.log(
            '========================================'
        );

        console.log('');

    }
);