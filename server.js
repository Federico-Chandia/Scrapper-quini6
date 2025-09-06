const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');

const app = express();
const PORT = 3000;

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

// Función para hacer scrapping de los resultados
async function scrapQuini6() {
  try {
    const response = await axios.get('https://www.quini-6-resultados.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    const resultados = [];
    
    // Buscar spans con clase sorteo
    $('span.sorteo').each((index, element) => {
      const sorteoTexto = $(element).text().trim();
      
      // Buscar el siguiente tr que contiene los números
      const $nextTr = $(element).closest('tr').next('tr');
      const numeros = $nextTr.find('td.nro').text().trim();
      
      if (sorteoTexto && numeros) {
        resultados.push({
          sorteo: sorteoTexto,
          numeros: numeros
        });
      }
    });
    
    return resultados;
  } catch (error) {
    console.error('Error al hacer scrapping:', error);
    throw error;
  }
}

// Función para guardar resultados en BD
function guardarResultados(resultados, fecha = null) {
  const fechaGuardar = fecha || new Date().toISOString().split('T')[0];
  
  resultados.forEach(resultado => {
    db.run(
      'INSERT OR IGNORE INTO sorteos (fecha, sorteo, numeros) VALUES (?, ?, ?)',
      [fechaGuardar, resultado.sorteo, resultado.numeros]
    );
  });
}

// Función para obtener enlaces de sorteos anteriores
async function obtenerEnlacesSorteos() {
  try {
    const response = await axios.get('https://www.quini-6-resultados.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    const enlaces = [];
    $('ul.links.list-unstyled li a').each((index, element) => {
      const href = $(element).attr('href');
      const texto = $(element).text().trim();
      
      // Extraer fecha del texto "Sorteo XXXX del dia DD/MM/YYYY"
      const fechaMatch = texto.match(/del dia (\d{2})\/(\d{2})\/(\d{4})/);
      if (fechaMatch) {
        const [, dia, mes, año] = fechaMatch;
        const fecha = `${año}-${mes}-${dia}`;
        enlaces.push({ url: href, fecha });
      }
    });
    
    return enlaces;
  } catch (error) {
    console.error('Error al obtener enlaces:', error);
    return [];
  }
}

// Función para hacer scrapping de un sorteo específico
async function scrapSorteoEspecifico(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.quini-6-resultados.com.ar/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    const resultados = [];
    
    // Buscar todos los h3 con clase verdeyblanco
    $('h3.verdeyblanco').each((index, element) => {
      const sorteoTexto = $(element).text().trim();
      
      // Limpiar el texto del sorteo
      let sorteo = sorteoTexto
        .replace('SORTEO ', '')
        .replace('LA SEGUNDA DEL QUINI', 'LA SEGUNDA')
        .replace('QUINI QUE SIEMPRE SALE', 'SIEMPRE SALE')
        .trim();
      
      // Buscar el siguiente elemento p con clase numeros
      const $nextP = $(element).next('p.numeros');
      
      if ($nextP.length && !sorteo.includes('POZO EXTRA')) {
        const numeros = $nextP.text().trim();
        
        if (sorteo && numeros) {
          resultados.push({ sorteo, numeros });
        }
      }
    });
    
    return resultados;
  } catch (error) {
    console.error(`Error al hacer scrapping de ${url}:`, error);
    return [];
  }
}

// Función para cargar sorteos históricos
async function cargarSorteosHistoricos() {
  try {
    const enlaces = await obtenerEnlacesSorteos();
    console.log(`Encontrados ${enlaces.length} enlaces de sorteos`);
    
    for (const enlace of enlaces) {
      console.log(`Procesando: ${enlace.url}`);
      const resultados = await scrapSorteoEspecifico(enlace.url);
      
      if (resultados.length > 0) {
        guardarResultados(resultados, enlace.fecha);
        console.log(`Guardados ${resultados.length} resultados del ${enlace.fecha}`);
      } else {
        console.log(`No se encontraron resultados para ${enlace.fecha}`);
      }
      
      // Pausa más larga para evitar detección
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('Carga de sorteos históricos completada');
  } catch (error) {
    console.error('Error al cargar sorteos históricos:', error);
  }
}

// Función para crear Pozo Extra
function crearPozoExtra(resultados) {
  if (resultados.length < 3) return null;
  
  const primerosTres = resultados.slice(0, 3);
  const todosNumeros = [];
  
  primerosTres.forEach(sorteo => {
    if (sorteo.numeros) {
      const nums = sorteo.numeros.split(' - ').map(n => parseInt(n.trim()));
      todosNumeros.push(...nums);
    }
  });
  
  const numerosSinRepetir = [...new Set(todosNumeros)].sort((a, b) => a - b);
  
  return {
    sorteo: 'POZO EXTRA',
    numeros: numerosSinRepetir.map(n => n.toString().padStart(2, '0')).join(' - ')
  };
}

// Endpoint para obtener los resultados actuales
app.get('/sorteos', async (req, res) => {
  try {
    const resultados = await scrapQuini6();
    console.log(`Encontrados ${resultados.length} resultados:`, resultados);
    
    if (resultados.length > 0) {
      guardarResultados(resultados);
    }
    
    const pozoExtra = crearPozoExtra(resultados);
    const todosResultados = pozoExtra ? [...resultados, pozoExtra] : resultados;
    
    res.json({
      success: true,
      data: todosResultados,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /sorteos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los resultados'
    });
  }
});

// Endpoint para obtener todos los sorteos (últimos 10)
app.get('/todoslossorteos', (req, res) => {
  db.all(
    'SELECT DISTINCT fecha FROM sorteos ORDER BY fecha DESC LIMIT 10',
    (err, fechas) => {
      if (err) {
        res.status(500).json({
          success: false,
          error: 'Error al obtener las fechas'
        });
        return;
      }
      
      const resultado = [];
      let completed = 0;
      
      if (fechas.length === 0) {
        res.json({
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      fechas.forEach(fechaRow => {
        db.all(
          'SELECT * FROM sorteos WHERE fecha = ? ORDER BY id',
          [fechaRow.fecha],
          (err, rows) => {
            if (!err) {
              // Eliminar duplicados
              const sorteosDia = rows.reduce((acc, row) => {
                const existe = acc.find(s => s.sorteo === row.sorteo && s.numeros === row.numeros);
                if (!existe) {
                  acc.push({ sorteo: row.sorteo, numeros: row.numeros });
                }
                return acc;
              }, []);
              
              const pozoExtra = crearPozoExtra(sorteosDia);
              const todosLosSorteos = pozoExtra ? [...sorteosDia, pozoExtra] : sorteosDia;
              
              resultado.push({
                fecha: fechaRow.fecha,
                sorteos: todosLosSorteos
              });
            }
            
            completed++;
            if (completed === fechas.length) {
              // Ordenar por fecha descendente
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

// Endpoint para obtener un sorteo específico por número
app.get('/sorteo/:nro', (req, res) => {
  const nro = parseInt(req.params.nro);
  
  if (isNaN(nro) || nro < 1 || nro > 10) {
    return res.status(400).json({
      success: false,
      error: 'Número de sorteo inválido. Debe ser entre 1 y 10'
    });
  }
  
  db.all(
    'SELECT DISTINCT fecha FROM sorteos ORDER BY fecha DESC LIMIT 10',
    (err, fechas) => {
      if (err || fechas.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Error al obtener las fechas'
        });
      }
      
      if (nro > fechas.length) {
        return res.status(404).json({
          success: false,
          error: `Solo hay ${fechas.length} sorteos disponibles`
        });
      }
      
      const fechaSeleccionada = fechas[nro - 1].fecha;
      
      db.all(
        'SELECT * FROM sorteos WHERE fecha = ? ORDER BY id',
        [fechaSeleccionada],
        (err, rows) => {
          if (err) {
            return res.status(500).json({
              success: false,
              error: 'Error al obtener el sorteo'
            });
          }
          
          const sorteosDia = rows.reduce((acc, row) => {
            const existe = acc.find(s => s.sorteo === row.sorteo && s.numeros === row.numeros);
            if (!existe) {
              acc.push({ sorteo: row.sorteo, numeros: row.numeros });
            }
            return acc;
          }, []);
          
          const pozoExtra = crearPozoExtra(sorteosDia);
          const todosLosSorteos = pozoExtra ? [...sorteosDia, pozoExtra] : sorteosDia;
          
          res.json({
            success: true,
            data: {
              numero: nro,
              fecha: fechaSeleccionada,
              sorteos: todosLosSorteos
            },
            timestamp: new Date().toISOString()
          });
        }
      );
    }
  );
});

// Endpoint para cargar sorteos históricos
app.get('/cargarhistoricos', async (req, res) => {
  try {
    await cargarSorteosHistoricos();
    res.json({
      success: true,
      message: 'Sorteos históricos cargados exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cargar sorteos históricos'
    });
  }
});

// Endpoint de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'Quini 6 Scrapper API',
    endpoints: {
      resultados: '/sorteos',
      todosLosSorteos: '/todoslossorteos',
      sorteoEspecifico: '/sorteo/{nro}',
      cargarHistoricos: '/cargarhistoricos'
    }
  });
});

// Función para scraping automático
async function scrapingAutomatico() {
  try {
    console.log('🔄 Iniciando scraping automático...');
    const resultados = await scrapQuini6();
    
    if (resultados.length > 0) {
      guardarResultados(resultados);
      console.log(`✅ Scraping automático completado: ${resultados.length} resultados guardados`);
    } else {
      console.log('⚠️ No se encontraron nuevos resultados');
    }
  } catch (error) {
    console.error('❌ Error en scraping automático:', error);
  }
}

// Programar scraping automático: Miércoles y Domingos a las 21:20
cron.schedule('20 21 * * 3,0', scrapingAutomatico, {
  timezone: 'America/Argentina/Buenos_Aires'
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('📅 Scraping automático programado: Miércoles y Domingos a las 21:20');
});