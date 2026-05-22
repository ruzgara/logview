from dataclasses import dataclass
from typing import Optional


@dataclass(slots=True)
class LogEvent:
    client_addr: Optional[str] = None
    client_host: Optional[str] = None
    client_port: Optional[str] = None
    request_addr: Optional[str] = None
    request_host: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    router_name: Optional[str] = None
    service_name: Optional[str] = None  
    start_local: Optional[str] = None
    request_accept_language: Optional[str] = None
    request_x_forwarded_for: Optional[str] = None
    request_cf_connecting_ip: Optional[str] = None
    request_cf_ipcountry: Optional[str] = None
    request_x_real_ip: Optional[str] = None

    @property
    def _real_ip(self) -> Optional[str]:
        if self.client_host:
            return self.client_host

        if self.request_cf_connecting_ip:
            return self.request_cf_connecting_ip

        if self.request_x_forwarded_for:
            return self.request_x_forwarded_for.split(",")[0].strip()

        return None
    
    @property
    def _country(self) -> Optional[str]:
        if self.request_cf_ipcountry:
            return self.request_cf_ipcountry
        elif self.request_accept_language:
            return self.request_accept_language.split(",")[0].split("-")[-1].strip()
        return None
    
    @property
    def _router(self) -> Optional[str]:
        if self.router_name:
            return self.router_name
        return None
    
    @property
    def _service(self) -> Optional[str]:
        if self.service_name:
            return self.service_name
        return None
    
    @property
    def _address(self) -> Optional[str]:
        if self.request_addr:
            return self.request_addr
        return None
    
    @property
    def _path(self) -> Optional[str]:
        if self.request_path:
            return self.request_path
        return None
    
    def connection_info(self) -> "ConnectionInfo":
        return ConnectionInfo(
            real_ip=self._real_ip,
            country=self._country,
            router=self._router,
            service=self._service,
            address=self._address,
            path=self._path,
        )


@dataclass(slots=True)
class ConnectionInfo:
    real_ip: str
    country: str
    router: str
    service: str
    address: str
    path: str