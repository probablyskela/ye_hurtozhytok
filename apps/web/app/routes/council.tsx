import { redirect } from "react-router";

// «Студрада» and «Люди й ролі» are now one page, «Мешканці».
export function loader() {
  throw redirect("/residents");
}
