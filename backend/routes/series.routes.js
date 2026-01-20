const express = require('express');
const router = express.Router();
const seriesController = require('../controllers/series.controller');

console.log('Series Controller Loaded:', Object.keys(seriesController));
console.log('getSeasonDetails type:', typeof seriesController.getSeasonDetails);

router.get('/popular', seriesController.getPopularSeries);
router.get('/top-rated', seriesController.getTopRatedSeries);
router.get('/trending', seriesController.getTrendingSeries);
router.get('/search', seriesController.searchSeries);
router.get('/:id/videos', seriesController.getVideos);
router.get('/:id/season/:seasonNumber', seriesController.getSeasonDetails);
router.get('/:id', seriesController.getSeriesDetails);

module.exports = router;
