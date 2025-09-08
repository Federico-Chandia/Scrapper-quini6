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