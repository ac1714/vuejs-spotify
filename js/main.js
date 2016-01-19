(function() {
	"use strict";

	var config = {
		apiConfig: {
			client_id: 'e837ec48b1a54042a3dbb014bf3f12af',
			response_type: 'token',
			redirect_uri: 'http://vue.dev',
			scope: 'user-read-private'		
		},
		redirectUrl: 'https://accounts.spotify.com/authorize?',
		apiUrl: 'https://api.spotify.com/v1',		
	};

	var vm = new Vue({

		el: '#app',		

		data: {

			// https://developer.spotify.com/web-api/authorization-guide/#implicit_grant_flow
			authResponse: JSON.parse(localStorage.getItem('auth')),
			userAuthenticated: true,
			searchQuery: '',
			searchResults: '',
			config: config,
			audioSource: '',
			currentTrack: {}
		},

		events: {
			'playing-track': function(track) {
				var self = this;
				return track.addEventListener("ended", function() 
			    {
			    	return self.currentTrack = {};
			   	});
			}
		},

		methods: {

			// redirect to spotify
			fetchAuthToken: function() {
				return window.location.href = this.config.redirectUrl + this.buildQueryString(this.config.apiConfig);
			},

			/**
			 * generate query string from object properties
			 * 
			 * @param  {object} obj
			 * @return {string}
			 */
			buildQueryString: function(obj) {
				var qs = [];
				for(var p in obj) {
					if (obj.hasOwnProperty(p)) {
				  		qs.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
					}
				}

				return qs.join("&");
			},

			/**
			 * convert query parameters to object
			 * 
			 * @param  {string} str
			 * @return {object}
			 */
			getQueryParametersObject: function(str) {
				return (str || document.location.search).replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
			},

			// get the data returned from spotify and convert to object
			getAuthResponse: function() {
				var qs = window.location.hash.split('#')[1];
				return this.getQueryParametersObject(qs);
			},

			/**
			 * check if an access token exists in the url
			 * if it does, save it to localstorage
			 * 
			 * @return {boolean}
			 */
			foundAccessToken: function() {
				
				if (window.location.href.indexOf('access_token') > -1) {
					localStorage.setItem('auth', JSON.stringify(this.getAuthResponse()));
					window.location.hash = '';
					return true;
				}
				return false;
			},

			/**
			 * bloodhound ajax settings
			 * 
			 * @param  {string} query
			 * @param  {object} settings
			 * @return {object}
			 */
			bloodhoundSearchSettings: function(query, settings) {
				// settings.headers = {
				// 	'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('auth')).access_token
				// }
				settings.data = {
					q: query + '*',
					type: 'artist,track',
					// market: 'from_token',
					limit: 10 // reminder: typeahead/bloodhound min length is 5 to render
				}
				return settings;				
			},

			/**
			 * sort an array by given property in descending order
			 * 
			 * @param  {array} data
			 * @param  {string} prop
			 * @return {array}
			 */
			sortByProperty: function(data, prop) {
				return data.sort(function(a, b) {
					return (a[prop] == b[prop]) ? 0 : (a[prop] < b[prop]) ? 1 : -1;
				});
			},

			/**
			 * convert milliseconds to mm:ss
			 * 
			 * @param  {int}
			 * @return {string}
			 */
			millisToMinutesAndSeconds: function(millis) {
			  var minutes = Math.floor(millis / 60000);
			  var seconds = ((millis % 60000) / 1000).toFixed(0);
			  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
			},

			/**
			 * transform an array of artists returned by spotify
			 * 
			 * @param  {array}
			 * @return {array}
			 */
			transformArtists: function(artists) {

				var transformedArtists = [];
				for (var i = 0; i < artists.length; i++) {
					var obj = artists[i];
					transformedArtists.push({
						popularity: obj.popularity,
						spotify_link: obj.external_urls.spotify,
						name: obj.name,
						type: obj.type,
						query: this.searchQuery,
						id: obj.id,
						thumbnail: obj.images[2] ? obj.images[2].url : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN49uz/fwAJTAPLQuEFBAAAAABJRU5ErkJggg=='
					});
				}

				return this.sortByProperty(transformedArtists, 'popularity');
			},

			/**
			 * transform an array of tracks returned by spotify
			 * 
			 * @param  {array}
			 * @return {[type]}
			 */
			transformTracks: function(tracks) {
				var transformedTracks = [];
				var self = this;

				for (var i = 0; i < tracks.length; i++) {
					var obj = tracks[i];

					transformedTracks.push({
						popularity: obj.popularity,
						artist: obj.artists[0] ? obj.artists[0].name : '',
						title: obj.name,
						preview: obj.preview_url,
						getAudioSource: function() {
							return new Audio(this.preview);
						},
						album: obj.album.name,
						duration: this.millisToMinutesAndSeconds(obj.duration_ms),
						type: obj.type,
						query: this.searchQuery,
						id: obj.id,
						thumbnail: obj.album.images[2] ? obj.album.images[2].url : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN49uz/fwAJTAPLQuEFBAAAAABJRU5ErkJggg=='
					});
				}

				console.log(transformedTracks);

				return this.sortByProperty(transformedTracks, 'popularity');
			},

			/**
			 * submit a search request
			 * 
			 * @param  {object} event
			 */
			submitSearch: function(e) {
				e.preventDefault();
				$('#typeahead').typeahead('close');

				if (/\S/.test(this.searchQuery)) {
					return this.searchByQuery(this.searchQuery);
				}

				return false;
			},

			/**
			 * get top tracks by artist id
			 * 
			 * @param  {string}
			 * @return mixed
			 */
			getArtistTopTracksById: function(id) {
				this.$http.get(this.config.apiUrl + '/artists/' + id + '/top-tracks', {country: 'SE'}).then(function (response) {
					return this.searchResults = this.transformTracks(response.data.tracks);
				}, function (response) {
				  return this.handleAjaxError(response.data.error);
				});				
			},

			/**
			 * get a single track by id
			 * 
			 * @param  {string}
			 * @return mixed
			 */
			getTrackById: function(id) {
				this.$http.get(this.config.apiUrl + '/tracks/' + id).then(function (response) {
					var tracks = [];
					tracks.push(response.data);
					this.searchResults = this.transformTracks(tracks);

					// doesnt work in mobile safari
					return this.playTrack(this.searchResults[0]);
				}, function (response) {
					return this.handleAjaxError(response.data.error);
				});	
			},

			/**
			 * submit a search query to spotify
			 * 
			 * @param  {string}
			 * @return mixed
			 */
			searchByQuery: function(query) {
				this.$http.get(this.config.apiUrl + '/search', {q: query, type: 'artist,track'}).then(function (response) {
					return this.searchResults = this.transformTracks(response.data.tracks.items);
				}, function (response) {
					return this.handleAjaxError(response.data.error);
				});				
			},

			/**
			 * notify the user if something goes wrong
			 * 
			 * @param  {object} error
			 * @return mixed
			 */
			handleAjaxError: function(error) {
				if (error.status == 401) {

					localStorage.removeItem('auth');
					self.userAuthenticated = false;

					swal({
						title: "Error!",
						text: "Spotify session token expired!",
						type: "error",
						confirmButtonText: "Sign in again",
						cancelButtonText: "Cancel",
						showCancelButton: true
					}, function(isConfirm) {
						if (isConfirm) {
							return self.fetchAuthToken();
						} else {
							return;
						}
					});
				}

				return swal({
							title: "Error!",
							text: error.message,
							type: "error",
							confirmButtonText: "Ok",
						});
			},	

			/**
			 * play a track
			 * 
			 * @param  {object}
			 * @return mixed
			 */
			playTrack: function(track) {

				// if selected track is currently playing, pause and clear
				if (this.audioSource && track == this.currentTrack) {
					this.currentTrack = {}
					return this.audioSource.pause();
				}

				// if a track is playing, stop current track and return the new one
				if (this.audioSource && !this.audioSource.paused) {
					this.pauseTrack();
					this.audioSource = track.getAudioSource();
					this.currentTrack = track;
					this.$emit('playing-track', this.audioSource);
		
					return this.audioSource.play();
				}

				// else just return the selected track
				this.currentTrack = track;
				this.audioSource = track.getAudioSource();
				this.$emit('playing-track', this.audioSource);

				return this.audioSource.play();
			},

			pauseTrack: function() {
				this.currentTrack = {};
				return this.audioSource.pause();
			}	

		},

		ready: function() {

			var self = this;

			// if (this.foundAccessToken() == true || localStorage.getItem('auth') !== null) {
			// 	this.userAuthenticated = true;
			// }

			var artists = new Bloodhound({
				initialize: true,
  				datumTokenizer: Bloodhound.tokenizers.whitespace('name'),				
  				queryTokenizer: Bloodhound.tokenizers.whitespace,
				remote: {
					url: this.config.apiUrl + '/search',
					prepare: function(query, settings) {
						return self.bloodhoundSearchSettings(query, settings);
					},
			        transport: function (settings, onSuccess, onError) {
			            $.ajax(settings).done(done).fail(fail);

			            function done(data, textStatus, request) {
			                onSuccess(data);
			            }

			            function fail(request, textStatus, errorThrown) {
			            	onError(errorThrown);
			            	return self.handleAjaxError(JSON.parse(request.responseText).error);
			            }
			        },						
					transform: function(response) {
						return self.transformArtists(response.artists.items);
					}
				}  				
			});

			var tracks = new Bloodhound({
				initialize: true,
  				datumTokenizer: Bloodhound.tokenizers.whitespace('track'),
  				queryTokenizer: Bloodhound.tokenizers.whitespace,
				remote: {
					url: this.config.apiUrl + '/search',				
					prepare: function(query, settings) {
						return self.bloodhoundSearchSettings(query, settings);
					},
					transform: function(response) {
						return self.transformTracks(response.tracks.items);
					}					
				}  				
			});

			var typeahead = $('#typeahead').typeahead({highlight: false, hint: false},
			{
				name: 'artists',
				source: artists.ttAdapter(),
				display: 'query',
			    templates: {
			    	header: '<h5 class="dataset-title">ARTISTS</h5>',
			        suggestion: function (artist) {
			            return '<div class="media">' +
			            			'<div class="media-left">' +
			            				'<img class="media-object img-circle" style="height: 40px; width: 40px" src="'+ artist.thumbnail +'">' +
			            			'</div>' +
			            			'<div class="media-body">' +
			            				'<h5 class="media-heading artist-name">' + artist.name + '</h5>' +
			            			'</div>' +
			            		'</div>';	
			        }
			    }			    			
			},
			{
				name: 'tracks',
				source: tracks.ttAdapter(),
				display: 'query',			
			    templates: {
			    	header: '<h5 class="dataset-title">TRACKS</h5>',
			        suggestion: function (track) {
			            return '<div class="media">' +
			            			'<div class="media-left">' +
			            				'<img class="media-object" style="height: 40px; width: 40px" src="'+ track.thumbnail +'">' +
			            			'</div>' +
			            			'<div class="media-body">' +
			            				'<h5 class="media-heading">' + track.title + '</h5>' +
			            				'<p>' + track.artist + '</p>' +
			            			'</div>' +
			            		'</div>';	
			        }
			    }				
			});

			typeahead.bind('typeahead:select', function(ev, suggestion) {
  				if (suggestion.type == 'artist') {
  					return self.getArtistTopTracksById(suggestion.id);
  				} else if (suggestion.type == 'track') {
  					return self.getTrackById(suggestion.id);
  				}
			});

		}

	})

})();