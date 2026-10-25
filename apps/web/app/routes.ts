import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("auth/google", "routes/auth-google.ts"),
  route("auth/callback", "routes/auth-callback.tsx"),
  route("logout", "routes/logout.ts"),
  route("welcome", "routes/welcome.tsx"),
  route("push", "routes/push.ts"),
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("book", "routes/book.tsx"),
    route("machines/:slug", "routes/machine.tsx"),
    route("bookings", "routes/bookings.tsx"),
    route("bookings/:id", "routes/booking.tsx"),
    route("profile", "routes/profile.tsx"),
    route("council", "routes/council.tsx"),
  ]),
] satisfies RouteConfig;
