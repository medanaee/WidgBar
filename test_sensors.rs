use sysinfo::{Components, System};

fn main() {
    let mut sys = System::new_all();
    let mut components = Components::new_with_refreshed_list();
    sys.refresh_all();
    components.refresh();
    
    println!("Components:");
    for component in components.iter() {
        println!("{:?} - label: {}, temp: {}", component, component.label(), component.temperature());
    }
}
