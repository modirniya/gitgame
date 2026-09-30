# The game as one image: the web client built, the server released, the rules beside it (M11). Host-agnostic: it
# needs a Postgres (DATABASE_URL), a SECRET_KEY_BASE and the host people reach it at (PHX_HOST); the choice of host is
# an ADR of its own. The client is served from the server's own origin, as the session cookie needs (ADR-0005).
#
#   docker build -t gitgame .
#   docker run -e DATABASE_URL=... -e SECRET_KEY_BASE=... -e PHX_HOST=... -p 4000:4000 gitgame
#
# The container migrates the database before it starts serving.

# ---------- the client ----------
FROM node:24-trixie-slim AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# the cards read their colors from the deck
COPY rules/ /build/rules/
RUN npm run build

# ---------- the server ----------
FROM hexpm/elixir:1.20.1-erlang-29.0.2-debian-trixie-20260610-slim AS server
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git && rm -rf /var/lib/apt/lists/*
ENV MIX_ENV=prod
WORKDIR /build/server
RUN mix local.hex --force && mix local.rebar --force
COPY server/mix.exs server/mix.lock ./
RUN mix deps.get --only prod && mkdir config
COPY server/config/config.exs server/config/prod.exs config/
RUN mix deps.compile
COPY server/priv priv
COPY server/lib lib
COPY server/rel rel
COPY server/config/runtime.exs config/
COPY rules/ priv/rules/
COPY --from=web /build/web/dist/ priv/static/
RUN mix compile && mix release

# ---------- what runs ----------
FROM debian:trixie-20260610-slim
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 locales ca-certificates \
  && rm -rf /var/lib/apt/lists/* && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8 MIX_ENV=prod
WORKDIR /app
RUN useradd --system --uid 1000 gitgame && chown gitgame /app
COPY --from=server --chown=gitgame /build/server/_build/prod/rel/gitgame ./
USER gitgame
EXPOSE 4000
CMD ["/bin/sh", "-c", "/app/bin/migrate && exec /app/bin/server"]
