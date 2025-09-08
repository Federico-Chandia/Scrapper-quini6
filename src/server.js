const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Inicializar base de datos
const db = new sqlite3.Database('./quini6.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sorteos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE,
    sorteo TEXT,
    numeros TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fecha, sorteo, numeros)
  )`);
  
  // Insertar datos de ejemplo si la tabla está vacía
  db.get('SELECT COUNT(*) as count FROM sorteos', (err, row) => {
    if (!err && row.count === 0) {
      const datosEjemplo = [
        // Septiembre 2025
        { fecha: '2025-09-07', sorteo: 'TRADICIONAL', numeros: '33 - 02 - 28 - 40 - 19 - 05' },
        { fecha: '2025-09-07', sorteo: 'LA SEGUNDA', numeros: '31 - 36 - 25 - 24 - 09 - 42' },
        { fecha: '2025-09-07', sorteo: 'REVANCHA', numeros: '03 - 27 - 12 - 50 - 18 - 75' },
        { fecha: '2025-09-03', sorteo: 'TRADICIONAL', numeros: '33 - 01 - 33 - 43 - 29 - 20' },
        { fecha: '2025-09-03', sorteo: 'LA SEGUNDA', numeros: '42 - 39 - 01 - 42 - 13 - 36' },
        { fecha: '2025-09-03', sorteo: 'REVANCHA', numeros: '12 - 50 - 18 - 75 - 25 - 00' },
        // Agosto 2025
        { fecha: '2025-08-31', sorteo: 'TRADICIONAL', numeros: '33 - 00 - 28 - 36 - 26 - 21' },
        { fecha: '2025-08-31', sorteo: 'LA SEGUNDA', numeros: '12 - 29 - 35 - 30 - 09 - 34' },
        { fecha: '2025-08-31', sorteo: 'REVANCHA', numeros: '01 - 28 - 12 - 50 - 18 - 75' },
        { fecha: '2025-08-27', sorteo: 'TRADICIONAL', numeros: '32 - 99 - 17 - 45 - 11 - 08' },
        { fecha: '2025-08-27', sorteo: 'LA SEGUNDA', numeros: '36 - 22 - 19 - 15 - 24 - 45' },
        { fecha: '2025-08-27', sorteo: 'REVANCHA', numeros: '02 - 07 - 10 - 00 - 15 - 00' },
        { fecha: '2025-08-24', sorteo: 'TRADICIONAL', numeros: '32 - 98 - 09 - 44 - 08 - 04' },
        { fecha: '2025-08-24', sorteo: 'LA SEGUNDA', numeros: '43 - 29 - 25 - 22 - 15 - 44' },
        { fecha: '2025-08-24', sorteo: 'REVANCHA', numeros: '26 - 35 - 10 - 00 - 15 - 00' },
        { fecha: '2025-08-20', sorteo: 'TRADICIONAL', numeros: '32 - 97 - 18 - 42 - 16 - 05' },
        { fecha: '2025-08-20', sorteo: 'LA SEGUNDA', numeros: '56 - 22 - 39 - 38 - 16 - 44' },
        { fecha: '2025-08-20', sorteo: 'REVANCHA', numeros: '27 - 34 - 10 - 00 - 15 - 00' },
        { fecha: '2025-08-17', sorteo: 'TRADICIONAL', numeros: '32 - 96 - 30 - 43 - 07 - 02' },
        { fecha: '2025-08-17', sorteo: 'LA SEGUNDA', numeros: '12 - 29 - 34 - 33 - 12 - 44' },
        { fecha: '2025-08-17', sorteo: 'REVANCHA', numeros: '05 - 17 - 10 - 00 - 15 - 00' },
        { fecha: '2025-08-13', sorteo: 'TRADICIONAL', numeros: '32 - 95 - 22 - 31 - 26 - 23' },
        { fecha: '2025-08-13', sorteo: 'LA SEGUNDA', numeros: '33 - 23 - 11 - 40 - 08 - 17' },
        { fecha: '2025-08-10', sorteo: 'TRADICIONAL', numeros: '32 - 94 - 32 - 44 - 09 - 01' },
        { fecha: '2025-08-10', sorteo: 'LA SEGUNDA', numeros: '32 - 22 - 17 - 44 - 07 - 23' },
        { fecha: '2025-08-06', sorteo: 'TRADICIONAL', numeros: '32 - 93 - 29 - 42 - 26 - 00' },
        { fecha: '2025-08-06', sorteo: 'LA SEGUNDA', numeros: '30 - 23 - 38 - 27 - 24 - 44' },
        { fecha: '2025-08-06', sorteo: 'REVANCHA', numeros: '04 - 32 - 10 - 00 - 15 - 00' }
      ];
      
      datosEjemplo.forEach(dato => {
        db.run('INSERT INTO sorteos (fecha, sorteo, numeros) VALUES (?, ?, ?)',
          [dato.fecha, dato.sorteo, dato.numeros]);
      });
      
      console.log('✅ Datos de ejemplo cargados');
    }
  });
});

// Función para crear Pozo Extra
function crearPozoExtra(resultados) {
  if (resultados.length < 3) return null;
  
  const primerosTres = resultados.slice(0, 3);
  const todosNumeros = [];
  
  primerosTres.forEach(sorteo => {
    const nums = sorteo.numeros.split(' - ').map(n => parseInt(n.trim()));
    todosNumeros.push(...nums);
  });
  
  const numerosSinRepetir = [...new Set(todosNumeros)].sort((a, b) => a - b);
  
  return {
    sorteo: 'POZO EXTRA',
    numeros: numerosSinRepetir.map(n => n.toString().padStart(2, '0')).join(' - ')
  };
}

// Endpoint para obtener resultados actuales
app.get('/sorteos', async (req, res) => {
  try {
    db.all(
      'SELECT * FROM sorteos WHERE fecha = (SELECT MAX(fecha) FROM sorteos) ORDER BY id',
      (err, rows) => {
        if (err || rows.length === 0) {
          return res.status(500).json({
            success: false,
            error: 'No hay datos disponibles'
          });
        }
        
        const resultados = rows.map(row => ({
          sorteo: row.sorteo,
          numeros: row.numeros
        }));
        
        const pozoExtra = crearPozoExtra(resultados);
        const todosResultados = pozoExtra ? [...resultados, pozoExtra] : resultados;
        
        res.json({
          success: true,
          data: todosResultados,
          fecha: rows[0].fecha,
          source: 'Base de Datos Local',
          timestamp: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener resultados'
    });
  }
});

// Endpoint para obtener todos los sorteos
app.get('/todoslossorteos', (req, res) => {
  db.all(
    'SELECT DISTINCT fecha FROM sorteos ORDER BY fecha DESC LIMIT 10',
    (err, fechas) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Error al obtener fechas'
        });
      }
      
      if (fechas.length === 0) {
        return res.json({
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        });
      }
      
      const resultado = [];
      let completed = 0;
      
      fechas.forEach(fechaRow => {
        db.all(
          'SELECT * FROM sorteos WHERE fecha = ? ORDER BY id',
          [fechaRow.fecha],
          (err, rows) => {
            if (!err) {
              const sorteosDia = rows.map(row => ({
                sorteo: row.sorteo,
                numeros: row.numeros
              }));
              
              const pozoExtra = crearPozoExtra(sorteosDia);
              const todosLosSorteos = pozoExtra ? [...sorteosDia, pozoExtra] : sorteosDia;
              
              resultado.push({
                fecha: fechaRow.fecha,
                sorteos: todosLosSorteos
              });
            }
            
            completed++;
            if (completed === fechas.length) {
              resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
              res.json({
                success: true,
                data: resultado,
                timestamp: new Date().toISOString()
              });
            }
          }
        );
      });
    }
  );
});

// Endpoint para sorteo específico
app.get('/sorteo/:nro', (req, res) => {
  const nro = req.params.nro;
  db.all(
    'SELECT * FROM sorteos WHERE fecha LIKE ? ORDER BY id',
    [`%${nro}%`],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Sorteo no encontrado'
        });
      }
      
      const resultados = rows.map(row => ({
        sorteo: row.sorteo,
        numeros: row.numeros
      }));
      
      res.json({
        success: true,
        data: resultados,
        fecha: rows[0].fecha,
        timestamp: new Date().toISOString()
      });
    }
  );
});

// Endpoint principal
app.get('/', (req, res) => {
  res.json({
    message: 'Quini 6 Scrapper API - Fuente Oficial Lotería Santa Fe',
    endpoints: {
      sorteos: '/sorteos',
      todosLosSorteos: '/todoslossorteos',
      sorteoEspecifico: '/sorteo/{nro}',
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log('🏛️ Fuente oficial: Lotería de Santa Fe');
});