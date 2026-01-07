module.exports = (req, res) => {
    res.status(200).json({
        status: 'Online',
        message: 'Supplier Platform Backend on Vercel',
        time: new Date().toISOString()
    });
};

// const app = require('../server');
// module.exports = app;