const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tenders.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files

// Ensure data directory exists
async function initializeData() {
    try {
        await fs.ensureDir(path.dirname(DATA_FILE));
        
        // Check if data file exists, if not create it with initial data
        if (!await fs.pathExists(DATA_FILE)) {
            const initialData = [
                {
                    id: "tender_001",
                    districtId: "1971",
                    status: "won",
                    province: "İstanbul",
                    district: "Kadıköy",
                    title: "ATM Kabinleri Projesi",
                    tender_duration: "36 ay",
                    cabin_count_total: 25,
                    cabin_count_full: 18,
                    rental_fee: "₺15,000/ay",
                    last_meeting_date: "2024-07-15",
                    meeting_notes: "Sözleşme imzalandı, kurulum başlatıldı.",
                    created_at: "2024-01-15T00:00:00.000Z",
                    updated_at: "2024-07-15T00:00:00.000Z"
                },
                {
                    id: "tender_002",
                    districtId: "1971",
                    status: "upcoming",
                    province: "İstanbul",
                    district: "Kadıköy",
                    title: "Ek Lokasyon Projesi",
                    tender_duration: "24 ay",
                    cabin_count_total: 10,
                    cabin_count_full: 0,
                    rental_fee: "₺8,000/ay",
                    foreseen_tender_date: "2024-10-01",
                    meeting_notes: "Mevcut projenin genişletilmesi planlanıyor.",
                    created_at: "2024-07-20T00:00:00.000Z",
                    updated_at: "2024-07-20T00:00:00.000Z"
                },
                {
                    id: "tender_003",
                    districtId: "1972",
                    status: "negotiating",
                    province: "İstanbul",
                    district: "Üsküdar",
                    title: "Ana İhale Projesi",
                    tender_duration: "24 ay",
                    cabin_count_total: 20,
                    cabin_count_full: 0,
                    rental_fee: "₺12,000/ay",
                    last_meeting_date: "2024-07-25",
                    meeting_notes: "Fiyat görüşmeleri devam ediyor. Rakip firma teklifleri değerlendiriliyor.",
                    created_at: "2024-05-10T00:00:00.000Z",
                    updated_at: "2024-07-25T00:00:00.000Z"
                },
                {
                    id: "tender_004",
                    districtId: "1973",
                    status: "upcoming",
                    province: "İstanbul",
                    district: "Beşiktaş",
                    title: "Merkezi Lokasyonlar Projesi",
                    tender_duration: "30 ay",
                    cabin_count_total: 15,
                    cabin_count_full: 0,
                    rental_fee: "₺18,000/ay",
                    foreseen_tender_date: "2024-09-15",
                    meeting_notes: "İhale dosyaları hazırlanıyor.",
                    created_at: "2024-06-01T00:00:00.000Z",
                    updated_at: "2024-08-01T00:00:00.000Z"
                },
                {
                    id: "tender_005",
                    districtId: "1974",
                    status: "lost",
                    province: "İstanbul",
                    district: "Şişli",
                    title: "Premium Lokasyonlar",
                    tender_duration: "24 ay",
                    cabin_count_total: 30,
                    cabin_count_full: 0,
                    rental_fee: "₺20,000/ay",
                    reason_for_loss: "Fiyat rekabeti nedeniyle kaybedildi",
                    meeting_notes: "Rakip firma %15 daha düşük teklif verdi.",
                    created_at: "2024-03-15T00:00:00.000Z",
                    updated_at: "2024-06-20T00:00:00.000Z"
                },
                {
                    id: "tender_006",
                    districtId: "798",
                    status: "won",
                    province: "Ankara",
                    district: "Çankaya",
                    title: "Başkent ATM Projesi",
                    tender_duration: "48 ay",
                    cabin_count_total: 40,
                    cabin_count_full: 35,
                    rental_fee: "₺22,000/ay",
                    last_meeting_date: "2024-06-10",
                    meeting_notes: "Başarılı proje, ek lokasyonlar için görüşme planlanıyor.",
                    created_at: "2023-12-01T00:00:00.000Z",
                    updated_at: "2024-06-10T00:00:00.000Z"
                },
                {
                    id: "tender_007",
                    districtId: "799",
                    status: "negotiating",
                    province: "Ankara",
                    district: "Keçiören",
                    title: "Sosyal Konut Projesi",
                    tender_duration: "36 ay",
                    cabin_count_total: 22,
                    cabin_count_full: 0,
                    rental_fee: "₺14,000/ay",
                    last_meeting_date: "2024-07-30",
                    meeting_notes: "Teknik şartname değişiklikleri görüşülüyor.",
                    created_at: "2024-04-01T00:00:00.000Z",
                    updated_at: "2024-07-30T00:00:00.000Z"
                },
                {
                    id: "tender_008",
                    districtId: "1158",
                    status: "won",
                    province: "İzmir",
                    district: "Konak",
                    title: "Liman Bölgesi Projesi",
                    tender_duration: "42 ay",
                    cabin_count_total: 32,
                    cabin_count_full: 28,
                    rental_fee: "₺19,000/ay",
                    last_meeting_date: "2024-05-20",
                    meeting_notes: "Mükemmel performans, yenileme sözleşmesi görüşülüyor.",
                    created_at: "2023-11-01T00:00:00.000Z",
                    updated_at: "2024-05-20T00:00:00.000Z"
                },
                {
                    id: "tender_009",
                    districtId: "1159",
                    status: "negotiating",
                    province: "İzmir",
                    district: "Bornova",
                    title: "Üniversite Kampüsü",
                    tender_duration: "30 ay",
                    cabin_count_total: 26,
                    cabin_count_full: 0,
                    rental_fee: "₺17,000/ay",
                    last_meeting_date: "2024-07-28",
                    meeting_notes: "Ödeme şartları ve garanti koşulları müzakere ediliyor.",
                    created_at: "2024-05-01T00:00:00.000Z",
                    updated_at: "2024-07-28T00:00:00.000Z"
                }
            ];
            
            await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
            console.log('✅ Initial tender data created');
        }
    } catch (error) {
        console.error('❌ Error initializing data:', error);
    }
}

// Helper function to read tenders data
async function readTenders() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading tenders:', error);
        return [];
    }
}

// Helper function to write tenders data
async function writeTenders(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing tenders data:', error);
        return false;
    }
}

// API Routes

// GET /api/tenders - Get all tenders
app.get('/api/tenders', async (req, res) => {
    try {
        const tenders = await readTenders();
        res.json({
            success: true,
            data: tenders,
            count: tenders.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching tenders',
            error: error.message
        });
    }
});

// GET /api/districts - Get district summary (for backwards compatibility and map rendering)
app.get('/api/districts', async (req, res) => {
    try {
        const tenders = await readTenders();
        
        // Group tenders by district and determine district status
        const districtMap = new Map();
        
        tenders.forEach(tender => {
            const key = `${tender.province}-${tender.district}`;
            if (!districtMap.has(key)) {
                districtMap.set(key, {
                    districtId: tender.districtId,
                    province: tender.province,
                    district: tender.district,
                    tenders: [],
                    status: 'no_tender'
                });
            }
            districtMap.get(key).tenders.push(tender);
        });
        
        // Determine overall district status based on tender priorities
        const districts = Array.from(districtMap.values()).map(district => {
            let status = 'no_tender';
            const statuses = district.tenders.map(t => t.status);
            
            // Priority: won > negotiating > upcoming > lost
            if (statuses.includes('won')) {
                status = 'won';
            } else if (statuses.includes('negotiating')) {
                status = 'negotiating';
            } else if (statuses.includes('upcoming')) {
                status = 'upcoming';
            } else if (statuses.includes('lost')) {
                status = 'lost';
            }
            
            return {
                districtId: district.districtId,
                status: status,
                details: {
                    province: district.province,
                    district: district.district,
                    tender_count: district.tenders.length,
                    total_value: district.tenders.reduce((sum, t) => {
                        const value = parseInt(t.rental_fee.replace(/[^0-9]/g, '')) || 0;
                        return sum + value;
                    }, 0),
                    latest_tender: district.tenders.sort((a, b) => 
                        new Date(b.updated_at) - new Date(a.updated_at)
                    )[0]
                }
            };
        });
        
        res.json({
            success: true,
            data: districts,
            count: districts.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching districts',
            error: error.message
        });
    }
});

// GET /api/tenders/:id - Get specific tender
app.get('/api/tenders/:id', async (req, res) => {
    try {
        const tenders = await readTenders();
        const tender = tenders.find(t => t.id === req.params.id);
        
        if (!tender) {
            return res.status(404).json({
                success: false,
                message: 'Tender not found'
            });
        }
        
        res.json({
            success: true,
            data: tender
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching tender',
            error: error.message
        });
    }
});

// GET /api/districts/:id/tenders - Get all tenders for a specific district
app.get('/api/districts/:id/tenders', async (req, res) => {
    try {
        const tenders = await readTenders();
        const districtTenders = tenders.filter(t => t.districtId === req.params.id);
        
        res.json({
            success: true,
            data: districtTenders,
            count: districtTenders.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching district tenders',
            error: error.message
        });
    }
});

// POST /api/tenders - Add new tender
app.post('/api/tenders', async (req, res) => {
    try {
        const { districtId, status, province, district, title, ...otherDetails } = req.body;
        
        // Validation
        if (!districtId || !status || !province || !district || !title) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: districtId, status, province, district, title'
            });
        }
        
        const tenders = await readTenders();
        
        // Generate unique ID for new tender
        const newId = `tender_${String(tenders.length + 1).padStart(3, '0')}`;
        
        const newTender = {
            id: newId,
            districtId,
            status,
            province,
            district,
            title,
            ...otherDetails,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        tenders.push(newTender);
        
        if (await writeTenders(tenders)) {
            res.status(201).json({
                success: true,
                message: 'Tender added successfully',
                data: newTender
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error saving tender'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding tender',
            error: error.message
        });
    }
});

// PUT /api/tenders/:id - Update tender
app.put('/api/tenders/:id', async (req, res) => {
    try {
        const tenders = await readTenders();
        const tenderIndex = tenders.findIndex(t => t.id === req.params.id);
        
        if (tenderIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Tender not found'
            });
        }
        
        const { status, ...updateData } = req.body;
        
        // Update tender
        tenders[tenderIndex] = {
            ...tenders[tenderIndex],
            ...(status && { status }),
            ...updateData,
            updated_at: new Date().toISOString()
        };
        
        if (await writeTenders(tenders)) {
            res.json({
                success: true,
                message: 'Tender updated successfully',
                data: tenders[tenderIndex]
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error updating tender'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating tender',
            error: error.message
        });
    }
});

// DELETE /api/tenders/:id - Delete tender
app.delete('/api/tenders/:id', async (req, res) => {
    try {
        const tenders = await readTenders();
        const tenderIndex = tenders.findIndex(t => t.id === req.params.id);
        
        if (tenderIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Tender not found'
            });
        }
        
        const deletedTender = tenders.splice(tenderIndex, 1)[0];
        
        if (await writeTenders(tenders)) {
            res.json({
                success: true,
                message: 'Tender deleted successfully',
                data: deletedTender
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error deleting tender'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting tender',
            error: error.message
        });
    }
});

// GET /api/stats - Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const tenders = await readTenders();
        const stats = {
            total_tenders: tenders.length,
            won: tenders.filter(t => t.status === 'won').length,
            negotiating: tenders.filter(t => t.status === 'negotiating').length,
            upcoming: tenders.filter(t => t.status === 'upcoming').length,
            lost: tenders.filter(t => t.status === 'lost').length
        };
        
        // District statistics
        const districtMap = new Map();
        tenders.forEach(tender => {
            const key = `${tender.province}-${tender.district}`;
            if (!districtMap.has(key)) {
                districtMap.set(key, { district: tender.district, province: tender.province, tenders: [] });
            }
            districtMap.get(key).tenders.push(tender);
        });
        
        stats.total_districts = districtMap.size;
        stats.districts_with_won = Array.from(districtMap.values()).filter(d => 
            d.tenders.some(t => t.status === 'won')
        ).length;
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'GeoScope API is running',
        timestamp: new Date().toISOString()
    });
});

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize data and start server
async function startServer() {
    await initializeData();
    
    app.listen(PORT, () => {
        console.log(`
🚀 GeoScope Backend Server Running!
📍 Server: http://localhost:${PORT}
📊 API Base: http://localhost:${PORT}/api
💾 Data File: ${DATA_FILE}
        `);
    });
}

startServer().catch(console.error);
