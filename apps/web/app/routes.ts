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
  route("bookings/:id/calendar.ics", "routes/booking-ics.ts"),
  route("media/*", "routes/media.ts"),
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("announcements", "routes/announcements.tsx"),
    route("announcements/new", "routes/announcement-new.tsx"),
    route("announcements/review", "routes/announcements-review.tsx"),
    route("announcements/:id", "routes/announcement.tsx"),
    route("announcements/:id/edit", "routes/announcement-edit.tsx"),
    route("laundry", "routes/laundry.tsx"),
    route("book", "routes/book.tsx"),
    route("machines/:slug", "routes/machine.tsx"),
    route("bookings", "routes/bookings.tsx"),
    route("bookings/:id", "routes/booking.tsx"),
    route("me", "routes/me.tsx"),
    route("profile", "routes/profile.tsx"),
    route("council", "routes/council.tsx"),
    route("roles", "routes/roles.tsx"),
  ]),
] satisfies RouteConfig;
