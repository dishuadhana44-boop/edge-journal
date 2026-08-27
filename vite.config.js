import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const API_KEY = env.TE_API_KEY;

  return {
    plugins: [
      react(),
      tailwindcss(),

      {
        name: "forex-news-api",

        configureServer(server) {
          server.middlewares.use(
            "/api/news",
            async (req, res) => {
              try {
                const url = new URL(
                  req.url,
                  "http://localhost"
                );

                const startDate =
                  url.searchParams.get("startDate");

                const endDate =
                  url.searchParams.get("endDate");

                const countries =
                  url.searchParams.get("countries") ||
                  "united states,euro area,united kingdom,japan,canada,australia";

                if (!API_KEY) {
                  res.statusCode = 500;

                  res.setHeader(
                    "Content-Type",
                    "application/json"
                  );

                  res.end(
                    JSON.stringify({
                      error:
                        "TE_API_KEY is missing in .env",
                    })
                  );

                  return;
                }

                const encodedCountries =
                  encodeURIComponent(countries);

                let apiUrl =
                  `https://api.tradingeconomics.com/calendar/country/${encodedCountries}?c=${encodeURIComponent(
                    API_KEY
                  )}&f=json`;

                if (startDate && endDate) {
                  apiUrl =
                    `https://api.tradingeconomics.com/calendar/country/${encodedCountries}/${startDate}/${endDate}?c=${encodeURIComponent(
                      API_KEY
                    )}&f=json`;
                }

                const response =
                  await fetch(apiUrl);

                const text =
                  await response.text();

                if (!response.ok) {
                  res.statusCode =
                    response.status;

                  res.setHeader(
                    "Content-Type",
                    "application/json"
                  );

                  res.end(
                    JSON.stringify({
                      error:
                        "Trading Economics API error",
                      details: text,
                    })
                  );

                  return;
                }

                const data =
                  JSON.parse(text);

                res.statusCode = 200;

                res.setHeader(
                  "Content-Type",
                  "application/json"
                );

                res.setHeader(
                  "Cache-Control",
                  "no-store"
                );

                res.end(
                  JSON.stringify(data)
                );
              } catch (error) {
                console.error(
                  "Forex News API Error:",
                  error
                );

                res.statusCode = 500;

                res.setHeader(
                  "Content-Type",
                  "application/json"
                );

                res.end(
                  JSON.stringify({
                    error:
                      "Failed to fetch live economic calendar",
                    message:
                      error.message,
                  })
                );
              }
            }
          );
        },
      },
    ],
  };
});