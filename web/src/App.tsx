import { MovieCard } from './components/movie-card';

function App() {
  const movie = {
    "adult": false,
    "backdrop_path": "/5h2EsPKNDdB3MAtOk9MB9Ycg9Rz.jpg",
    "belongs_to_collection": {
      "id": 1084247,
      "name": "Zootopia Collection",
      "poster_path": "/u8597pdwSHOvcJQhP2cLi7a67ZW.jpg",
      "backdrop_path": "/1WDssJDYInLA4Avg45lgy3WM6Ly.jpg"
    },
    "budget": 150000000,
    "genres": [
      { "id": 16, "name": "Animation" },
      { "id": 10751, "name": "Family" },
      { "id": 35, "name": "Comedy" },
      { "id": 12, "name": "Adventure" },
      { "id": 9648, "name": "Mystery" }
    ],
    "homepage": "https://movies.disney.com/zootopia-2",
    "id": 1084242,
    "imdb_id": "tt26443597",
    "origin_country": ["US"],
    "original_language": "en",
    "original_title": "Zootopia 2",
    "overview": "After cracking the biggest case in Zootopia's history, rookie cops Judy Hopps and Nick Wilde find themselves on the twisting trail of a great mystery when Gary De'Snake arrives and turns the animal metropolis upside down. To crack the case, Judy and Nick must go undercover to unexpected new parts of town, where their growing partnership is tested like never before.",
    "popularity": 531.3208,
    "poster_path": "/oJ7g2CifqpStmoYQyaLQgEU32qO.jpg",
    "production_companies": [
      {
        "id": 6125,
        "logo_path": "/tzsMJBJZINu7GHzrpYzpReWhh66.png",
        "name": "Walt Disney Animation Studios",
        "origin_country": "US"
      }
    ],
    "production_countries": [
      { "iso_3166_1": "US", "name": "United States of America" }
    ],
    "release_date": "2025-11-26",
    "revenue": 556400000,
    "runtime": 107,
    "spoken_languages": [
      { "english_name": "English", "iso_639_1": "en", "name": "English" },
      { "english_name": "Spanish", "iso_639_1": "es", "name": "Español" }
    ],
    "status": "Released",
    "tagline": "Zootopia will be changed furrrever...",
    "title": "Zootopia 2",
    "video": false,
    "vote_average": 7.638,
    "vote_count": 181
  };

  return (
    <div>
      <MovieCard
        title={movie.title}
        posterUrl="https://image.tmdb.org/t/p/w1280/3Wg1LBCiTEXTxRrkNKOqJyyIFyF.jpg"
        releaseDate={movie.release_date}
        description={movie.overview}
        runtimeMinutes={movie.runtime}
        rating={movie.vote_average}
        genres={movie.genres.map(g => g.name)}
        language={movie.spoken_languages[0]?.english_name || movie.original_language}
        tagline={movie.tagline}
        studio={movie.production_companies[0]?.name}
      />
    </div>
  );
}

export default App;
