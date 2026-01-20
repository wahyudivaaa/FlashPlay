const tmdbService = require('../services/tmdb.service');

exports.getPopularSeries = async (req, res) => {
    try {
        const page = req.query.page || 1;
        const data = await tmdbService.getPopularSeries(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTopRatedSeries = async (req, res) => {
    try {
        const page = req.query.page || 1;
        const data = await tmdbService.getTopRatedSeries(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTrendingSeries = async (req, res) => {
    try {
        const data = await tmdbService.getTrendingSeries();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSeriesDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await tmdbService.getSeriesDetails(id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.searchSeries = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }
        const data = await tmdbService.searchSeries(query);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getVideos = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await tmdbService.getSeriesVideos(id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSeasonDetails = async (req, res) => {
    try {
        const { id, seasonNumber } = req.params;
        const data = await tmdbService.getSeriesSeasonDetails(id, seasonNumber);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
