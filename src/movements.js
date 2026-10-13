// Gerakan pathfinder yang tidak menggali lubang vertikal ke bawah.
// Pathfinder bawaan bisa "turun dengan menggali" bila itu lebih murah daripada berjalan memutar,
// sehingga bot membuat lubang lurus ke bawah saat mengejar ore. Di sini gerakan turun yang
// membutuhkan penggalian dibuang. Penggalian mendatar (terowongan) tetap diizinkan.
import pathfinderPkg from 'mineflayer-pathfinder';

const { Movements } = pathfinderPkg;

export class NoDigDownMovements extends Movements {
  getMoveDown(node, neighbors) {
    const start = neighbors.length;
    super.getMoveDown(node, neighbors);
    for (let i = neighbors.length - 1; i >= start; i--) {
      if (neighbors[i].toBreak.length > 0) neighbors.splice(i, 1);
    }
  }
}

/** Pengaturan gerakan standar bot ini. */
export function createMovements(bot) {
  return new NoDigDownMovements(bot);
}
