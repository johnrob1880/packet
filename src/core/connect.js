export default function connect(host) {
    if (window) {
      window.packet = window.packet || { hosts: [] };
    }

    window.packet.hosts.push(host);
}
